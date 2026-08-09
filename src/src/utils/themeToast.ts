import utils from './utils.ts';

class ToastSetup {
    private toastDuration = 3000
    private toastClass = 'elaina-theme-toast'

    toastStyle(): void {
        utils.styleEngine.apply('theme-toast', `
            .${this.toastClass} .pengu-toast-icon {
                width: 1.25rem;
                height: 1.25rem;
                flex: 0 0 1.25rem;
                color: transparent !important;
                font-size: 0 !important;
                background-image: ${utils.assets.cssIcon('logo.webp')};
                background-position: center;
                background-repeat: no-repeat;
                background-size: contain;
            }

            .${this.toastClass}.pengu-toast-loading .pengu-toast-icon {
                animation: none !important;
            }
        `, { shadow: true });
    }

    options(id: string): ToastOptions {
        return {
            id,
            duration: this.toastDuration,
            position: 'bottom-left',
            icon: '',
            className: this.toastClass,
            dismissable: true,
        };
    }

    push(kind: ThemeToastKind, message: string, id: string): string {
        this.toastStyle();

        const toast = window.Toast;
        const method = toast[kind] || toast.success;
        return method.call(toast, message, this.options(id));
    }
}

class ThemeToast extends ToastSetup {
    success(message: string, id: string): string {
        return this.push('success', message, id);
    }

    error(message: string, id: string): string {
        return this.push('error', message, id);
    }

    info(message: string, id: string): string {
        return this.push('info', message, id);
    }

    warning(message: string, id: string): string {
        return this.push('warning', message, id);
    }

    loading(message: string, id: string): string {
        return this.push('loading', message, id);
    }

    promise<T>(promise: Promise<T>, messages: ThemeToastMessages, id: string): Promise<T> {
        this.loading(messages.loading, id);

        void promise.then(
            () => {
                if (messages.success) this.success(messages.success, id);
                else window.Toast.dismiss?.(id);
            },
            (error) => {
                const message = typeof messages.error === 'function'
                    ? messages.error(error)
                    : messages.error;

                if (message) this.error(message, id);
                else window.Toast.dismiss?.(id);
            },
        );

        return promise;
    }
};

export const themeToast = new ThemeToast();