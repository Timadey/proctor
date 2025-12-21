/**
 * BrowserTelemetryModule
 * Monitors browser interactions: tab switches, focus, keyboard, clipboard
 */

export class BrowserTelemetryModule {
    constructor(options = {}) {
        this.options = {
            onEvent: null,
            ...options
        };

        // Event handlers
        this.handlers = {
            visibilityChange: this.handleVisibilityChange.bind(this),
            windowBlur: this.handleWindowBlur.bind(this),
            windowFocus: this.handleWindowFocus.bind(this),
            contextMenu: this.handleContextMenu.bind(this),
            copy: this.handleCopy.bind(this),
            paste: this.handlePaste.bind(this),
            cut: this.handleCut.bind(this),
            keyDown: this.handleKeyDown.bind(this),
            fullscreenChange: this.handleFullscreenChange.bind(this),
            beforeUnload: this.handleBeforeUnload.bind(this),
            mouseLeave: this.handleMouseLeave.bind(this),
            mouseEnter: this.handleMouseEnter.bind(this)
        };

        // State tracking
        this.state = {
            isVisible: !document.hidden,
            isFocused: document.hasFocus(),
            isFullscreen: !!document.fullscreenElement,
            isMouseInWindow: true,
            tabSwitchCount: 0,
            focusLossCount: 0,
            copyCount: 0,
            pasteCount: 0,
            rightClickCount: 0,
            suspiciousKeyCount: 0,
            mouseLeaveCount: 0,
            lastTabSwitchTime: null,
            lastFocusLossTime: null
        };

        this.isRunning = false;
    }

    /**
     * Initialize module
     */
    initialize() {
        console.log('✅ BrowserTelemetryModule initialized');
    }

    /**
     * Start monitoring
     */
    start() {
        this.isRunning = true;

        // Document events
        document.addEventListener('visibilitychange', this.handlers.visibilityChange);
        document.addEventListener('contextmenu', this.handlers.contextMenu);
        document.addEventListener('copy', this.handlers.copy);
        document.addEventListener('paste', this.handlers.paste);
        document.addEventListener('cut', this.handlers.cut);
        document.addEventListener('keydown', this.handlers.keyDown);
        document.addEventListener('fullscreenchange', this.handlers.fullscreenChange);

        // Window events
        window.addEventListener('blur', this.handlers.windowBlur);
        window.addEventListener('focus', this.handlers.windowFocus);
        window.addEventListener('beforeunload', this.handlers.beforeUnload);
        window.addEventListener('mouseleave', this.handlers.mouseLeave);
        window.addEventListener('mouseenter', this.handlers.mouseEnter);

        console.log('🚀 BrowserTelemetryModule started');
    }

    /**
     * Stop monitoring
     */
    stop() {
        this.isRunning = false;

        // Remove document events
        document.removeEventListener('visibilitychange', this.handlers.visibilityChange);
        document.removeEventListener('contextmenu', this.handlers.contextMenu);
        document.removeEventListener('copy', this.handlers.copy);
        document.removeEventListener('paste', this.handlers.paste);
        document.removeEventListener('cut', this.handlers.cut);
        document.removeEventListener('keydown', this.handlers.keyDown);
        document.removeEventListener('fullscreenchange', this.handlers.fullscreenChange);

        // Remove window events
        window.removeEventListener('blur', this.handlers.windowBlur);
        window.removeEventListener('focus', this.handlers.windowFocus);
        window.removeEventListener('beforeunload', this.handlers.beforeUnload);
        window.removeEventListener('mouseleave', this.handlers.mouseLeave);
        window.removeEventListener('mouseenter', this.handlers.mouseEnter);

        console.log('🛑 BrowserTelemetryModule stopped');
    }

    /**
     * Event Handlers
     */

    handleVisibilityChange() {
        this.state.isVisible = !document.hidden;

        if (document.hidden) {
            this.state.tabSwitchCount++;
            this.state.lastTabSwitchTime = Date.now();

            this.emitEvent('TAB_SWITCHED', 10, {
                hidden: true,
                count: this.state.tabSwitchCount,
                severity: 'critical'
            });
        } else {
            this.emitEvent('TAB_RETURNED', 2, {
                hidden: false,
                count: this.state.tabSwitchCount,
                duration: this.state.lastTabSwitchTime ?
                    Date.now() - this.state.lastTabSwitchTime : 0
            });
        }
    }

    handleWindowBlur() {
        this.state.isFocused = false;
        this.state.focusLossCount++;
        this.state.lastFocusLossTime = Date.now();

        this.emitEvent('WINDOW_FOCUS_LOST', 8, {
            focused: false,
            count: this.state.focusLossCount,
            severity: 'high'
        });
    }

    handleWindowFocus() {
        this.state.isFocused = true;

        this.emitEvent('WINDOW_FOCUS_RESTORED', 2, {
            focused: true,
            duration: this.state.lastFocusLossTime ?
                Date.now() - this.state.lastFocusLossTime : 0
        });
    }

    handleContextMenu(e) {
        this.state.rightClickCount++;

        this.emitEvent('RIGHT_CLICK', 5, {
            x: e.clientX,
            y: e.clientY,
            count: this.state.rightClickCount,
            severity: 'medium'
        });
    }

    handleCopy(e) {
        this.state.copyCount++;

        // Try to get copied text (may be blocked)
        let copiedText = '';
        try {
            copiedText = window.getSelection().toString();
        } catch (err) {
            // Ignore
        }

        this.emitEvent('COPY_ATTEMPT', 7, {
            count: this.state.copyCount,
            textLength: copiedText.length,
            severity: 'medium'
        });
    }

    handlePaste(e) {
        this.state.pasteCount++;

        this.emitEvent('PASTE_ATTEMPT', 9, {
            count: this.state.pasteCount,
            severity: 'high'
        });
    }

    handleCut(e) {
        this.emitEvent('CUT_ATTEMPT', 7, {
            severity: 'medium'
        });
    }

    handleKeyDown(e) {
        // Detect suspicious key combinations
        const suspiciousKeys = [
            { check: e.ctrlKey && e.key === 'c', name: 'Ctrl+C' },
            { check: e.ctrlKey && e.key === 'v', name: 'Ctrl+V' },
            { check: e.ctrlKey && e.key === 'x', name: 'Ctrl+X' },
            { check: e.ctrlKey && e.key === 'a', name: 'Ctrl+A' },
            { check: e.altKey && e.key === 'Tab', name: 'Alt+Tab' },
            { check: e.metaKey && e.key === 'Tab', name: 'Cmd+Tab' },
            { check: e.key === 'PrintScreen', name: 'PrintScreen' },
            { check: e.key === 'F12', name: 'F12' },
            { check: e.ctrlKey && e.shiftKey && e.key === 'I', name: 'Ctrl+Shift+I' },
            { check: e.ctrlKey && e.shiftKey && e.key === 'J', name: 'Ctrl+Shift+J' },
            { check: e.ctrlKey && e.shiftKey && e.key === 'C', name: 'Ctrl+Shift+C' },
            { check: e.ctrlKey && e.key === 'u', name: 'Ctrl+U' }
        ];

        const detected = suspiciousKeys.find(k => k.check);

        if (detected) {
            this.state.suspiciousKeyCount++;

            this.emitEvent('SUSPICIOUS_KEY_PRESS', 6, {
                key: detected.name,
                count: this.state.suspiciousKeyCount,
                severity: 'medium'
            });
        }
    }

    handleFullscreenChange() {
        this.state.isFullscreen = !!document.fullscreenElement;

        if (!document.fullscreenElement) {
            this.emitEvent('EXITED_FULLSCREEN', 8, {
                severity: 'high'
            });
        } else {
            this.emitEvent('ENTERED_FULLSCREEN', 1, {
                severity: 'info'
            });
        }
    }

    handleBeforeUnload(e) {
        this.emitEvent('PAGE_UNLOAD_ATTEMPT', 9, {
            severity: 'high'
        });
    }

    handleMouseLeave() {
        this.state.isMouseInWindow = false;
        this.state.mouseLeaveCount++;

        this.emitEvent('MOUSE_LEFT_WINDOW', 4, {
            count: this.state.mouseLeaveCount,
            severity: 'low'
        });
    }

    handleMouseEnter() {
        this.state.isMouseInWindow = true;

        this.emitEvent('MOUSE_ENTERED_WINDOW', 1, {
            severity: 'info'
        });
    }

    /**
     * Emit event
     */
    emitEvent(type, severity, metadata = {}) {
        if (this.options.onEvent) {
            this.options.onEvent({
                event: type,
                lv: severity,
                ts: Date.now(),
                ...metadata
            });
        }
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get telemetry summary
     */
    getSummary() {
        return {
            tabSwitches: this.state.tabSwitchCount,
            focusLosses: this.state.focusLossCount,
            copyAttempts: this.state.copyCount,
            pasteAttempts: this.state.pasteCount,
            rightClicks: this.state.rightClickCount,
            suspiciousKeys: this.state.suspiciousKeyCount,
            mouseLeaves: this.state.mouseLeaveCount,
            currentState: {
                isVisible: this.state.isVisible,
                isFocused: this.state.isFocused,
                isFullscreen: this.state.isFullscreen,
                isMouseInWindow: this.state.isMouseInWindow
            }
        };
    }

    /**
     * Destroy module
     */
    destroy() {
        this.stop();
        console.log('🗑️ BrowserTelemetryModule destroyed');
    }
}