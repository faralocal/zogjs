# Zog.js

Full reactivity with minimal code size.

Zog.js is a minimalist JavaScript library for building reactive user interfaces. It allows you to write clean, declarative templates directly in your HTML and power them with a simple, yet powerful, reactivity system. Inspired by the best parts of modern frameworks, Zog.js offers an intuitive developer experience with zero dependencies and no build step required.

---

## Highlights

* Reactive primitives: `ref`, `reactive`, `computed`
* Effects: `watchEffect`
* Lightweight template compiler for declarative DOM binding and interpolation (`{{ }}`)
* Template directives: `z-if`, `z-for`, `z-text`, `z-html`, `z-show`, `z-model`, `z-on` (shorthand `@`)
* App lifecycle: `createApp(...).mount(selector)` and `.unmount()`
* Plugin system: `use(plugin, options)` for extending functionality

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
        import { createApp, ref } from './zog.js';

        createApp(() => {
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
* `reactive(object)` — returns a reactive proxy of an object (deep reactive for nested objects and arrays).
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
* `z-for="item in list"` or `z-for="(item, index) in list"` — repeat an element for each item. Supports `:key` attribute for optimized diffing.
* `z-text="expression"` — set `textContent`.
* `z-html="expression"` — set `innerHTML`.
* `z-show="expression"` — toggles `display` (`none` when falsy).
* `z-model="prop"` — two-way binding for `input`, `select`, `textarea`; supports checkbox/radio semantics.
* `z-on:event="handler"` or shorthand `@event="handler"` — attach event listener; handler may be a function in scope or an expression.
* `:attribute="expression"` — bind any attribute dynamically (supports style objects, class objects/strings, and boolean attributes).

### Plugin system

Zog.js supports a plugin architecture to extend functionality:

```js
import { use } from './zog.js';

const MyPlugin = {
    install(zog, options) {
        // Access Zog APIs: reactive, ref, computed, watchEffect, createApp
        // Add global functionality
        console.log('Plugin installed with options:', options);
    }
};

use(MyPlugin, { theme: 'dark' });
```

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
  use
} from './zog.js';
```

### `ref(value)`

Creates a reactive reference.

* Usage: `const count = ref(0)`
* Access: `count.value`
* Assignment: `count.value = 2`

### `reactive(obj)`

Wraps an object or array in a reactive proxy. Supports deep reactivity for nested structures.

* Usage: `const state = reactive({ todos: [] })`
* Access / mutate like normal object: `state.todos.push('x')`
* Array methods (push, pop, splice, etc.) are fully reactive

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

### `use(plugin, options?)`

Install a plugin to extend Zog.js functionality.

* `plugin` must have an `install(zog, options)` method
* Plugins receive access to core APIs and utilities
* Prevents duplicate installations automatically

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
    <li z-for="(item, i) in todos" :key="item">
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
  <div z-if="show">
    <p z-html="htmlContent"></p>
  </div>
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

### Dynamic styling and classes

```html
<div id="styling">
  <button @click="toggleActive">Toggle Active</button>
  <div 
    :class="{ active: isActive, 'text-bold': true }"
    :style="{ color: textColor, fontSize: size + 'px' }">
    Styled content
  </div>
</div>

<script type="module">
import { createApp, ref } from './zog.js';

createApp(() => {
  const isActive = ref(false);
  const textColor = ref('blue');
  const size = ref(16);
  
  const toggleActive = () => isActive.value = !isActive.value;
  
  return { isActive, textColor, size, toggleActive };
}).mount('#styling');
</script>
```

---

## Template directive quick reference

| Directive                       | Purpose                                     | Example                                                    |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `{{ expr }}`                    | Interpolate JS expression from scope        | `<p>Hello, {{ name }}</p>`                                 |
| `z-if` / `z-else-if` / `z-else` | Conditional rendering                       | `<div z-if="isOpen">Open</div>`                            |
| `z-for`                         | Loop: `item in list` or `(item, i) in list` | `<li z-for="(item, i) in items">{{ i }} - {{ item }}</li>` |
| `:key`                          | Unique key for z-for optimization           | `<li z-for="item in items" :key="item.id">`                |
| `z-text`                        | Set `textContent`                           | `<p z-text="message"></p>`                                 |
| `z-html`                        | Set `innerHTML`                             | `<div z-html="rawHtml"></div>`                             |
| `z-show`                        | Toggle display (style)                      | `<div z-show="visible">...</div>`                          |
| `z-model`                       | Two-way binding with inputs                 | `<input z-model="value" />`                                |
| `z-on:event` or `@event`        | Event listener                              | `<button @click="handle">Click</button>`                   |
| `:attribute`                    | Dynamic attribute binding                   | `<div :id="dynamicId" :disabled="isDisabled">`             |
| `:class`                        | Dynamic class binding (object/string)       | `<div :class="{ active: isActive }">`                      |
| `:style`                        | Dynamic style binding (object)              | `<div :style="{ color: textColor }">`                      |

Notes:

* Event directive accepts a scope function or expression (`@click="doSomething"` where `doSomething` exists in scope).
* `z-for` supports `in` and `of` and `(item, index)` tuple syntax.
* `:key` attribute optimizes list rendering by reusing DOM elements efficiently.
* Boolean attributes (like `disabled`, `checked`) are handled automatically with `:` binding.

---

## Creating plugins

Plugins allow you to extend Zog.js with custom functionality. Here's a simple example:

```js
// my-plugin.js
export default {
    install(zog, options) {
        const { reactive, ref, watchEffect } = zog;
        
        // Add custom functionality
        console.log('My plugin installed!', options);
        
        // You can access internal utilities if needed
        const { Dep, ReactiveEffect } = zog.utils;
    }
};

// main.js
import { use } from './zog.js';
import MyPlugin from './my-plugin.js';

use(MyPlugin, { debug: true });
```

Plugin use cases:
* Router implementations
* State management solutions
* Development tools
* Form validation
* Animation helpers
* HTTP clients

---

## Tips & Gotchas

* Template expressions are evaluated against the scope object returned by your `setup()` function.
* Refs must be accessed with `.value` in JavaScript, but are automatically unwrapped in templates.
* Array reactivity is fully supported - methods like `push`, `pop`, `splice` trigger updates automatically.
* Use `:key` in `z-for` loops for better performance when lists change.
* The library is ESM: import using `type="module"` or bundle with a bundler (Vite, Webpack, Rollup).
* `z-html` can cause XSS vulnerabilities - only use with trusted content.

---

## Development & contributing

* The repository contains the single-file implementation `zog.js`. Tests and build tooling are not included by default.
* To experiment, create an HTML page with `<script type="module">` and import `./zog.js`.

---

## License

Zog.js is open-source software licensed under the MIT License.
You are free to use, modify, and distribute this project in commercial or non-commercial applications.

For full details, see the [LICENSE](/LICENSE) file.

---

## Changelog

### 0.2.3 (Current)
* Added plugin system with `use()` function
* Optimized expression evaluator with caching
* Unified array method handling for smaller bundle size
* Improved z-for diffing algorithm
* Reduced code size by ~100 lines

### 0.2.2
* Full array reactivity support
* Key-based diffing for z-for
* Deep reactive objects and arrays
* Complete directive system