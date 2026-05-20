declare module 'mic' {
    namespace mic {
        interface MicOptions {
            rate?: string;
            channels?: string;
            debug?: boolean;
            encoding?: string;
            endian?: string;
            device?: string;
            bitwidth?: string;
        }

        interface MicInstance {
            start: () => void;
            stop: () => void;
            getAudioStream: () => NodeJS.ReadableStream;
        }
    }

    function mic(options?: mic.MicOptions): mic.MicInstance;

    export = mic;
}
