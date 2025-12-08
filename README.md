# Zog.js

Full reactivity with minimal code size.

Zog.js is a minimalist JavaScript library for building reactive user interfaces. It allows you to write clean, declarative templates directly in your HTML and power them with a simple, yet powerful, reactivity system. Inspired by the best parts of modern frameworks, Zog.js offers an intuitive developer experience with zero dependencies and no build step required.

---

## Highlights

* Reactive primitives: `ref`, `reactive`, `computed`
* Effects & watchers: `watchEffect`
* Lightweight template compiler for declarative DOM binding and interpolation (`{{ }}`)
* Template directives: `z-if`, `z-for`, `z-text`, `z-html`, `z-show`, `z-model`, `z-on` (shorthand `@`)
* Minimal router snapshot: `route.path`, `route.hash`, `route.query`
* App lifecycle: `createApp(...).mount(selector)` and `.unmount()`
* Utilities: `nextTick`, `unref`, `toRef`

---

## Quick start

### Using the file directly (ES module)

Place `zog.js` next to your HTML or serve it via your bundler. Example HTML:

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Zog.js Counter</title>
</head>
<body>

    <!-- 1. Define your component's HTML structure -->
    <div id="app">
        <h1>{{ title }}</h1>
        <p>Current count: {{ count }}</p>
        <button @click="increment">Increment</button>
        <button @click="decrement">Decrement</button>
    </div>

    <!-- 2. Import Zog.js -->
    <script type="module">
        import { createApp, ref } from 'https://cdn.zogjs.com/zog.es.js'; // Or from a CDN

        createApp(()=>{

                const title = ref('Counter App');
                const count = ref(0);

                const increment = () => {
                    count.value++;
                };

                const decrement = () => {
                    count.value--;
                };

                // Expose state and methods to the template
                return {
                    title,
                    count,
                    increment,
                    decrement
                };
        }).mount('#app');
    </script>
</body>
</html>
```

---

## Core concepts

### Reactivity primitives

* `ref(initialValue)` — creates a reactive reference with `.value`.
* `reactive(object)` — returns a reactive proxy of an object (deep reactive for nested objects).
* `computed(getter)` — memoized reactive value that recomputes when dependencies change.
* `watchEffect(fn, opts?)` — run a reactive effect immediately and re-run when dependencies change. Returns a function to stop the effect.

### Template interpolation

Any text node containing `{{ expression }}` will be evaluated against the component scope:

```html
<p>Hello, {{ name }} — you have {{ items.length }} items.</p>
```

Expressions are evaluated in the scope you return from `createApp` (see examples).

### Template directives

The compiler supports a small set of directives for common tasks:

* `z-if="expression"` — render element only when truthy.
* `z-else-if="expression"` and `z-else` — chainable conditional branches.
* `z-for="item in list"` or `z-for="(item, index) in list"` — repeat an element for each item.
* `z-text="expression"` — set `textContent`.
* `z-html="expression"` — set `innerHTML`.
* `z-show="expression"` — toggles `display` (`none` when falsy).
* `z-model="prop"` — two-way binding for `input`, `select`, `textarea`; supports checkbox/radio semantics.
* `z-on:event="handler"` or shorthand `@event="handler"` — attach event listener; handler may be a function in scope or an expression.

### Router snapshot

A lightweight reactive snapshot of the browser location:

* `route.path` — `location.pathname`
* `route.hash` — `location.hash`
* `route.query` — query object parsed from `location.search`

These properties are reactive — reading them inside `watchEffect` or `computed` will subscribe to updates from `hashchange`/`popstate`.

---

## API Reference

> Import signature (example)

```js
import {
  createApp,
  ref,
  reactive,
  computed,
  watchEffect,
  route,
  nextTick,
  unref,
  toRef
} from './zog.js';
```

### `ref(value)`

Creates a reactive reference.

* Usage: `const count = ref(0)`
* Access: `count.value`
* Assignment: `count.value = 2`

### `reactive(obj)`

Wraps an object in a reactive proxy.

* Usage: `const state = reactive({ todos: [] })`
* Access / mutate like normal object: `state.todos.push('x')`

### `computed(getter)`

Creates a lazily evaluated computed value.

* Usage: `const doubled = computed(() => count.value * 2)`
* Access: `doubled.value`

### `watchEffect(fn, opts?)`

Run `fn` immediately, re-run whenever a reactive dependency used inside `fn` changes.

* Returns a stop function: `const stop = watchEffect(() => { ... }); stop();`
* `opts` can include a `scheduler` function.

### `createApp(setup)`

Creates an app instance. `setup` is a function returning the reactive scope object to be used in templates.

* `const app = createApp(() => ({ /* scope */ }))`
* `app.mount(selector)` — mount on DOM node
* `app.unmount()` — cleanup

### `route`

Reactive snapshot with getters:

* `route.path`, `route.hash`, `route.query`

### Utilities

* `nextTick(fn)` — schedule `fn` on the microtask queue (useful after DOM updates).
* `unref(v)` — returns `v.value` if `v` is a ref, otherwise `v`.
* `toRef(obj, key)` — create a proxy ref pointing to `obj[key]`.

---

## Examples

### Simple counter (HTML + script)

```html
<div id="counter">
  <p>Count: <span z-text="count"></span></p>
  <button @click="inc">+1</button>
</div>

<script type="module">
import { createApp, ref } from './zog.js';

createApp(() => {
  const count = ref(0);
  const inc = () => count.value++;
  return { count, inc };
}).mount('#counter');
</script>
```

### Todo list (reactive object + z-for)

```html
<div id="todo">
  <input z-model="newItem" placeholder="Add todo" />
  <button @click="add">Add</button>

  <ul>
    <li z-for="(item, i) in todos">
      {{ i + 1 }}. {{ item }}
      <button @click="remove(i)">remove</button>
    </li>
  </ul>
</div>

<script type="module">
import { createApp, reactive, ref } from './zog.js';

createApp(() => {
  const state = reactive({ todos: ['Buy milk'] });
  const newItem = ref('');

  function add() {
    if (newItem.value.trim()) {
      state.todos.push(newItem.value.trim());
      newItem.value = '';
    }
  }

  function remove(i) {
    state.todos.splice(i, 1);
  }

  return {
    todos: state.todos,
    newItem,
    add,
    remove
  };
}).mount('#todo');
</script>
```

### Conditional rendering & raw HTML

```html
<div id="cond">
  <button @click="toggle">Toggle</button>
  <template z-if="show">
    <p z-html="htmlContent"></p>
  </template>
</div>

<script type="module">
import { createApp, ref } from './zog.js';

createApp(() => {
  const show = ref(true);
  const htmlContent = ref('<em>Rendered HTML</em>');
  const toggle = () => show.value = !show.value;
  return { show, htmlContent, toggle };
}).mount('#cond');
</script>
```

---

## Template directive quick reference

| Directive                       |                                     Purpose | Example                                                    |
| ------------------------------- | ------------------------------------------: | ---------------------------------------------------------- |
| `{{ expr }}`                    |        Interpolate JS expression from scope | `<p>Hello, {{ name }}</p>`                                 |
| `z-if` / `z-else-if` / `z-else` |                       Conditional rendering | `<div z-if="isOpen">Open</div>`                            |
| `z-for`                         | Loop: `item in list` or `(item, i) in list` | `<li z-for="(item, i) in items">{{ i }} - {{ item }}</li>` |
| `z-text`                        |                           Set `textContent` | `<p z-text="message"></p>`                                 |
| `z-html`                        |                             Set `innerHTML` | `<div z-html="rawHtml"></div>`                             |
| `z-show`                        |                      Toggle display (style) | `<div z-show="visible">...</div>`                          |
| `z-model`                       |                 Two-way binding with inputs | `<input z-model="value" />`                                |
| `z-on:event` or `@event`        |                              Event listener | `<button @click="handle">Click</button>`                   |

Notes:

* Event directive accepts a scope function or expression (`@click="doSomething"` where `doSomething` exists in scope).
* `z-for` supports `in` and `of` and `(item, index)` tuple syntax.

---

## Router usage (reactive snapshot)

Zog.js exposes a small reactive `route` object:

```js
import { route } from './zog.js';

watchEffect(() => {
  console.log('current path:', route.path);
});
```

`route` updates automatically on `hashchange` and `popstate`.

---

## Tips & Gotchas

* Template expressions are evaluated against the scope object returned by your `setup()` function.
* Use `toRef(obj, 'prop')` to pass a reference to a nested property when a ref is required.
* Use `nextTick()` if you need to run code after the DOM updates caused by reactive changes.
* The library is ESM: import using `type="module"` or bundle with a bundler (Vite, Webpack, Rollup).

---

## Development & contributing

* The repository contains the single-file implementation `zog.js`. Tests and build tooling are not included by default.
* To experiment, create an HTML page with `<script type="module">` and import `./zog.js`.
* If you plan to add features or refactors:

  * Keep the public API stable (exports listed above).
  * Document any additional template directives clearly.
  * Add minimal reproducible examples for each new feature.

---

## License

Zog.js is open-source software licensed under the MIT License.
You are free to use, modify, and distribute this project in commercial or non-commercial applications.

For full details, see the [LICENSE](/LICENSE) file.
---

