/**
 * Zog.js v0.4.7 - Minimal reactive framework
 */

// --- Reactivity Core ---
let activeEffect = null;
const effectStack = [];
let currentScope = null;

class Dep {
    subs = new Set();
    depend() {
        if (activeEffect && !this.subs.has(activeEffect)) {
            this.subs.add(activeEffect);
            activeEffect.deps.push(this);
        }
    }
    notify() {
        new Set(this.subs).forEach(e => {
            if (e !== activeEffect) e.scheduler ? e.scheduler(e.run.bind(e)) : queueEffect(e);
        });
    }
}

let effectQueue = [], isFlushing = false;

const queueEffect = effect => {
    if (!effectQueue.includes(effect)) {
        effectQueue.push(effect);
        if (!isFlushing) { isFlushing = true; Promise.resolve().then(flushEffects); }
    }
};

const flushEffects = () => {
    const queue = effectQueue.slice().sort((a, b) => a.id - b.id);
    effectQueue.length = 0;
    isFlushing = false;
    for (const e of queue) {
        if (e.active) try { e.run(); } catch (err) { console.error?.('Effect error:', err); runHooks('onError', err, 'effect', e); }
    }
};

let effectId = 0;

class ReactiveEffect {
    constructor(fn, scheduler = null) {
        this.id = effectId++;
        this.fn = fn;
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true;
    }
    run() {
        if (!this.active) return this.fn();
        this.cleanup();
        try {
            effectStack.push(this);
            activeEffect = this;
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    }
    stop() {
        if (this.active) { this.cleanup(); this.active = false; }
    }
    cleanup() {
        for (const dep of this.deps) dep.subs.delete(this);
        this.deps.length = 0;
    }
}

export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run();
    const stop = () => effect.stop();
    currentScope?.addEffect(stop);
    return stop;
};

// --- Deep Reactivity ---
const RAW = Symbol('raw'), IS_REACTIVE = Symbol('isReactive');
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const arrayMutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const arrayIterators = new Set(['includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex', 'findLast', 'findLastIndex', 'every', 'some', 'forEach', 'map', 'filter', 'reduce', 'reduceRight', 'flat', 'flatMap', 'values', 'entries', 'keys', Symbol.iterator]);

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;
    if (reactiveMap.has(target)) return reactiveMap.get(target);

    const isArray = Array.isArray(target);
    const depsMap = new Map(), iterationDep = new Dep();
    const getDep = k => depsMap.get(k) || (depsMap.set(k, new Dep()), depsMap.get(k));

    const createArrayMethod = method => {
        const isMut = arrayMutators.has(method), isIter = arrayIterators.has(method);
        return function (...args) {
            const raw = this[RAW];
            if (!isMut && isIter) iterationDep.depend();

            let res;
            if (method === 'includes' || method === 'indexOf' || method === 'lastIndexOf') {
                getDep('length').depend();
                for (let i = 0; i < raw.length; i++) getDep(String(i)).depend();
                res = Array.prototype[method].call(raw, args[0]?.[RAW] ?? args[0], ...args.slice(1));
            } else {
                res = Array.prototype[method].apply(isMut ? raw : this, args);
            }

            if (isMut) {
                iterationDep.notify();
                getDep('length').notify();
                // notify all indices for methods that change element positions
                if (method === 'sort' || method === 'reverse' || method === 'shift' || method === 'unshift')
                    for (let i = 0; i < raw.length; i++) getDep(String(i)).notify();
            }
            return isObj(res) && !res[IS_REACTIVE] ? reactive(res) : res;
        };
    };

    const arrayMethods = isArray ? Object.fromEntries([...arrayMutators, ...arrayIterators].map(m => [m, createArrayMethod(m)])) : null;

    const proxy = new Proxy(target, {
        get(t, k, r) {
            if (k === RAW) return t;
            if (k === IS_REACTIVE) return true;
            if (isArray && arrayMethods?.[k]) return arrayMethods[k];
            getDep(k).depend();
            const res = Reflect.get(t, k, r);
            return isObj(res) ? (res[IS_REACTIVE] ? res : reactive(res)) : res;
        },
        set(t, k, v, r) {
            const old = t[k], hadKey = has(t, k);
            const res = Reflect.set(t, k, v, r);
            if (!hadKey || !Object.is(old, v)) {
                getDep(k).notify();
                if (!hadKey || (isArray && (k === 'length' || String(+k) === k))) iterationDep.notify();
            }
            return res;
        },
        deleteProperty(t, k) {
            const hadKey = has(t, k);
            const res = Reflect.deleteProperty(t, k);
            if (hadKey) { getDep(k).notify(); iterationDep.notify(); }
            return res;
        },
        ownKeys(t) { iterationDep.depend(); return Reflect.ownKeys(t); },
        has(t, k) { getDep(k).depend(); return Reflect.has(t, k); }
    });

    reactiveMap.set(target, proxy);
    return proxy;
};

// --- ref / computed ---
export const ref = val => {
    // only accepts primitive values
    if (isObj(val)) {
        console.warn('ref() only accepts primitive values. Use reactive() for objects and arrays.');
        throw new Error('ref() cannot be used with objects or arrays. Use reactive() instead.');
    }
    
    let v = val;
    const dep = new Dep();
    return {
        _isRef: true,
        get value() { dep.depend(); return v; },
        set value(nv) {
            if (isObj(nv)) {
                console.warn('ref() value cannot be set to an object or array. Use reactive() instead.');
                throw new Error('ref() value cannot be set to an object or array.');
            }
            if (!Object.is(nv, v)) { v = nv; dep.notify(); }
        },
        toString: () => String(v)
    };
};

export const computed = getter => {
    let value, dirty = true;
    const dep = new Dep();
    const effect = new ReactiveEffect(getter, () => { if (!dirty) { dirty = true; dep.notify(); } });
    return {
        _isRef: true,
        get value() { if (dirty) { value = effect.run(); dirty = false; } dep.depend(); return value; },
        _effect: effect
    };
};

// --- Scope ---
class Scope {
    constructor(data) { this.data = data; this.effects = []; this.listeners = []; this.children = []; }
    addEffect(stop) { this.effects.push(stop); }
    addListener(el, ev, fn) { this.listeners.push({ el, ev, fn }); }
    addChild(child) { this.children.push(child); }
    removeChild(child) { this.children = this.children.filter(c => c !== child); }
    cleanup() {
        this.children.forEach(c => c.cleanup());
        this.children.length = 0;
        this.effects.forEach(stop => stop?.());
        this.effects.length = 0;
        this.listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
        this.listeners.length = 0;
    }
}

// --- Expression Eval ---
const expCache = new Map();

const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const cacheKey = exp + '|' + keys.join(',');
        let fn = expCache.get(cacheKey);
        if (!fn) {
            fn = Function(...keys, `"use strict";try{return(${exp})}catch(e){return undefined}`);
            if (expCache.size > 500) expCache.delete(expCache.keys().next().value);
            expCache.set(cacheKey, fn);
        }
        const vals = keys.map(k => { const v = scope[k]; return v?._isRef ? v.value : v; });
        return fn(...vals);
    } catch { return undefined; }
};

// --- Hooks ---
const hooks = {};
export const onHook = (name, fn) => (hooks[name] = hooks[name] || []).push(fn);
const runHooks = (name, ...args) => hooks[name]?.forEach(fn => fn(...args));

// --- Compiler ---
const walk = (node, fn) => { fn(node); [...node.childNodes].forEach(c => walk(c, fn)); };

const compile = (el, scope, cs) => {
    runHooks('beforeCompile', el, scope, cs);
    
    if (el.nodeType === 3) {
        const text = el.nodeValue;
        const regex = /\{\{([^}]+)\}\}/g;
        if (!regex.test(text)) return;
        
        const parts = [];
        let lastIdx = 0, match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text))) {
            if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
            parts.push({ exp: match[1].trim() });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push(text.slice(lastIdx));
        
        cs.addEffect(watchEffect(() => {
            el.nodeValue = parts.map(p => typeof p === 'string' ? p : evalExp(p.exp, scope) ?? '').join('');
        }));
        return;
    }
    
    if (el.nodeType !== 1) return;

    // z-if
    if (el.hasAttribute('z-if')) {
        const branches = [], parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        let curr = el;
        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            branches.push({ template: curr.cloneNode(true), exp, type, el: null, scope: null });
            const next = curr.nextElementSibling;
            parent.removeChild(curr);
            curr = next;
        }

        cs.addEffect(watchEffect(() => {
            let chosen = null;
            for (const b of branches) if (b.type === 'z-else' || evalExp(b.exp, scope)) { chosen = b; break; }

            branches.forEach(b => {
                if (b === chosen) {
                    if (!b.el) {
                        b.el = b.template.cloneNode(true);
                        b.scope = new Scope({ ...scope });
                        cs.addChild(b.scope);
                        parent.insertBefore(b.el, ph.nextSibling);
                        compile(b.el, b.scope.data, b.scope);
                    }
                } else if (b.scope) {
                    b.el?.remove();
                    b.scope.cleanup();
                    cs.removeChild(b.scope);
                    b.scope = null;
                    b.el = null;
                }
            });
        }));
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // z-for
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        const m = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(\w+))\s+(?:in|of)\s+(.*)$/);
        const itemName = m?.[1] || m?.[3] || 'item';
        const indexName = m?.[2] || 'index';
        const listExp = m?.[4] || rawFor.split(/\s+(?:in|of)\s+/)[1]?.trim() || rawFor;

        const parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        const keyAttr = el.getAttribute(':key') || el.getAttribute('z-key');
        if (keyAttr) { el.removeAttribute(':key'); el.removeAttribute('z-key'); }

        let itemsMap = new Map();

        cs.addEffect(watchEffect(() => {
            let arr = evalExp(listExp, scope);
            if (arr?._isRef) arr = arr.value;
            if (!Array.isArray(arr)) arr = [];

            const newItemsMap = new Map(), newKeys = [];

            arr.forEach((v, i) => {
                // create key for tracking
                const key = '_' + (keyAttr ? evalExp(keyAttr, { ...scope, [itemName]: v, [indexName]: i }) : i);
                newKeys.push(key);
                
                const existing = itemsMap.get(key);
                
                // convert to reactive if object
                const val = isObj(v) && !v[IS_REACTIVE] ? reactive(v) : v;
                const isReactiveObj = val && val[IS_REACTIVE];

                if (existing) {
                    // if item is a reactive object and reference changed
                    if (isReactiveObj && existing.itemValue !== val) {
                        // reference changed, need to rebuild item
                        existing.clone.remove();
                        existing.scope.cleanup();
                        cs.removeChild(existing.scope);
                        // continue to create new item
                    } else {
                        // update existing item
                        if (!isReactiveObj) {
                            // for primitive values, update the ref
                            existing.itemRef.value = val;
                        }
                        // update index in scope data
                        existing.scope.data[indexName] = i;
                        newItemsMap.set(key, existing);
                        return;
                    }
                }

                // create new item
                const clone = el.cloneNode(true);
                
                // for reactive objects, use the object directly
                // for primitive values, use ref
                let itemValue, itemRef;
                if (isReactiveObj) {
                    itemValue = val;
                    itemRef = null; // no ref needed for reactive objects
                } else {
                    itemRef = ref(val);
                    itemValue = itemRef;
                }
                
                const indexValue = i;
                const s = new Scope({ ...scope, [itemName]: itemValue, [indexName]: indexValue });
                cs.addChild(s);
                compile(clone, s.data, s);
                newItemsMap.set(key, { clone, scope: s, itemValue, itemRef });
            });

            // remove old items
            for (const [key, item] of itemsMap) {
                if (!newItemsMap.has(key)) {
                    item.clone.remove();
                    item.scope.cleanup();
                    cs.removeChild(item.scope);
                }
            }

            // reorder DOM nodes
            let prevNode = ph;
            for (const key of newKeys) {
                const item = newItemsMap.get(key);
                if (item.clone.previousSibling !== prevNode) parent.insertBefore(item.clone, prevNode.nextSibling);
                prevNode = item.clone;
            }
            itemsMap = newItemsMap;
        }));
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    // Directives
    for (const { name, value } of [...el.attributes]) {
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name[0] === '@' ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            const fn = e => {
                if (typeof scope[value] === 'function') scope[value](e);
                else try {
                    const keys = Object.keys(scope);
                    const vals = keys.map(k => scope[k]);
                    Function(...keys, 'e', `"use strict";${value}`)(...vals, e);
                } catch (err) {
                    console.error?.('Event error:', err);
                    runHooks('onError', err, 'event', { name, value });
                }
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';
            const fn = () => {
                if (el.type === 'radio' && !el.checked) return;
                if (scope[value]?._isRef) scope[value].value = el[prop];
                else evalExp(value + '=_v', { ...scope, _v: el[prop] });
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                el.type === 'radio' ? el.checked = String(el.value) === String(res) : el[prop] = res;
            }));
        }
        else if (name === 'z-text' || name === 'z-html' || name === 'z-show' || name.startsWith(':') || name.startsWith('z-')) {
            const attr = name[0] === ':' ? name.slice(1) : name;
            el.removeAttribute(name);
            const staticClass = attr === 'class' ? (el.getAttribute('class') || '') : '';
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (attr === 'z-text') el.textContent = res ?? '';
                else if (attr === 'z-html') el.innerHTML = res ?? '';
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && isObj(res)) Object.assign(el.style, res);
                else if (attr === 'class') {
                    el.setAttribute('class', (isObj(res) 
                        ? staticClass + ' ' + Object.keys(res).filter(k => res[k]).join(' ')
                        : typeof res === 'string' ? staticClass + ' ' + res : staticClass).trim());
                }
                else {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    typeof res === 'boolean' ? (res ? el.setAttribute(setName, '') : el.removeAttribute(setName))
                        : res == null ? el.removeAttribute(setName) : el.setAttribute(setName, res);
                }
            }));
        }
    }

    [...el.childNodes].forEach(child => compile(child, scope, cs));
    runHooks('afterCompile', el, scope, cs);
};

export const nextTick = fn => Promise.resolve().then(fn);

// --- App ---
export const createApp = setup => {
    let rootScope = null;
    const appContext = { plugins: new Set() };

    return {
        use(plugin, options = {}) {
            if (appContext.plugins.has(plugin)) return this;
            if (typeof plugin.install !== 'function') { console.error?.('Plugin must have install method'); return this; }
            plugin.install({
                app: this,
                reactive, ref, computed, watchEffect,
                onHook, compile, Scope, evalExp
            }, options);
            appContext.plugins.add(plugin);
            return this;
        },
        mount(root) {
            const el = typeof root === 'string' ? document.querySelector(root) : root;
            if (!el) { console.error?.('Root not found:', root); return; }

            rootScope = new Scope({});
            currentScope = rootScope;
            rootScope.data = setup?.() || {};
            currentScope = null;
            try { compile(el, rootScope.data, rootScope); }
            catch (err) { console.error?.('Compile error:', err); runHooks('onError', err, 'compile', { el }); }
            return this;
        },
        unmount() { rootScope?.cleanup(); rootScope = null; }
    };
};