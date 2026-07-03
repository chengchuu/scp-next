/**
 * @author Cheng
 */
import $ from "jquery";

declare global {
  interface PerformanceEntry {
    readonly processingStart?: DOMHighResTimeStamp;
    readonly processingEnd?: DOMHighResTimeStamp;
    readonly value?: number;
  }

  interface NetworkInformation {
    readonly rtt?: number;
    readonly downlink?: number;
    readonly effectiveType?: string;
    readonly saveData?: boolean;
  }

  interface Navigator {
    readonly connection?: NetworkInformation;
  }

  interface ErrorEvent {
    type?: string;
    time?: number;
    readonly message: string;
    readonly filename: string;
    fileName?: string;
    readonly lineno: number;
    line?: number;
    readonly colno: number;
    column?: number;
    stack?: string;
    name?: string;
  }

  interface Window {
    $: typeof $;
    jQuery: typeof $;
  }
}
