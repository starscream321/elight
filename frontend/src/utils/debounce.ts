type DebouncedFn<Args extends unknown[]> = (...args: Args) => void;
type DebouncedCallback<Args extends unknown[]> = (...args: Args) => unknown | Promise<unknown>;

function debounce<Args extends unknown[]>(
    callback: DebouncedCallback<Args>,
    delay: number,
    onError: (error: unknown) => void = console.error,
): DebouncedFn<Args> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            Promise.resolve(callback(...args)).catch(onError);
        }, delay);
    };
}

export default debounce;
