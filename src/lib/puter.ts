let puterLoadingPromise: Promise<any> | null = null;

/**
 * Centrally loads the Puter.js library.
 * Guarantees that the script tag is added exactly once and sets `puter.quiet = true`.
 */
export const loadPuter = (): Promise<any> => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  // If Puter is already fully loaded, configure it and resolve
  if ((window as any).puter) {
    (window as any).puter.quiet = true;
    return Promise.resolve((window as any).puter);
  }

  // If a loading promise is already active, reuse it
  if (puterLoadingPromise) {
    return puterLoadingPromise;
  }

  puterLoadingPromise = new Promise((resolve, reject) => {
    // Check again to avoid race conditions
    if ((window as any).puter) {
      (window as any).puter.quiet = true;
      resolve((window as any).puter);
      return;
    }

    // Check if the script tag already exists in the document (injected outside this loader)
    const existingScript = document.querySelector(
      'script[src*="js.puter.com"]',
    );
    if (existingScript) {
      const check = setInterval(() => {
        if ((window as any).puter) {
          clearInterval(check);
          (window as any).puter.quiet = true;
          resolve((window as any).puter);
        }
      }, 50);
      return;
    }

    // Inject the script tag
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.async = true;

    s.onload = () => {
      const check = setInterval(() => {
        if ((window as any).puter) {
          clearInterval(check);
          (window as any).puter.quiet = true;
          resolve((window as any).puter);
        }
      }, 50);
    };

    s.onerror = (err) => {
      reject(err);
    };

    document.head.appendChild(s);
  });

  return puterLoadingPromise;
};
