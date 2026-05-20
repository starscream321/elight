/// <reference types="vite/client" />

declare module '*.svg' {
    import type { Component } from 'vue';

    const component: Component;
    export default component;
}
