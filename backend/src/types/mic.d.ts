declare module 'mic' {
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

    function mic(options?: MicOptions): MicInstance;

    export default mic;
}