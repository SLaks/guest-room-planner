interface PickerDoc {
  id: string;
  name?: string;
  mimeType?: string;
  url?: string;
}

interface PickerResponseData {
  action: string;
  docs?: PickerDoc[];
}

interface GooglePickerGlobal {
  picker: {
    PickerBuilder: new () => {
      addView: (view: unknown) => GooglePickerBuilderInstance;
      setOAuthToken: (token: string) => GooglePickerBuilderInstance;
      setCallback: (
        cb: (data: PickerResponseData) => void
      ) => GooglePickerBuilderInstance;
      setOrigin: (origin: string) => GooglePickerBuilderInstance;
      setTitle: (title: string) => GooglePickerBuilderInstance;
      build: () => { setVisible: (visible: boolean) => void };
    };
    DocsView: new (viewId?: string) => {
      setIncludeFolders: (include: boolean) => unknown;
      setSelectFolderEnabled: (enabled: boolean) => unknown;
    };
    ViewId: {
      DOCS: string;
      SPREADSHEETS: string;
    };
    Action: {
      PICKED: string;
      CANCEL: string;
    };
  };
}

type GooglePickerBuilderInstance = ReturnType<
  () => InstanceType<GooglePickerGlobal['picker']['PickerBuilder']>
>;

declare global {
  interface Window {
    gapi?: {
      load: (api: string, options: { callback: () => void; onerror?: () => void }) => void;
    };
    google?: GooglePickerGlobal;
  }
}

let pickerLoadPromise: Promise<void> | null = null;

function loadGooglePickerApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Picker requires a browser environment.'));
  }
  if (window.google?.picker) {
    return Promise.resolve();
  }
  if (pickerLoadPromise) {
    return pickerLoadPromise;
  }

  pickerLoadPromise = new Promise<void>((resolve, reject) => {
    const loadPickerModule = () => {
      if (!window.gapi) {
        pickerLoadPromise = null;
        reject(new Error('Google API loader failed to initialize.'));
        return;
      }
      window.gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => {
          pickerLoadPromise = null;
          reject(new Error('Failed to load Google Picker library.'));
        },
      });
    };

    if (window.gapi) {
      loadPickerModule();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', loadPickerModule, { once: true });
      existingScript.addEventListener(
        'error',
        () => {
          pickerLoadPromise = null;
          reject(new Error('Failed to load Google API script.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = loadPickerModule;
    script.onerror = () => {
      pickerLoadPromise = null;
      reject(new Error('Failed to load Google API script.'));
    };
    document.head.appendChild(script);
  });

  return pickerLoadPromise;
}

export interface PickedSpreadsheet {
  spreadsheetId: string;
  name: string;
}

export async function pickSpreadsheetWithGooglePicker(
  accessToken: string
): Promise<PickedSpreadsheet | null> {
  await loadGooglePickerApi();

  const googleGlobal = window.google;
  if (!googleGlobal?.picker) {
    throw new Error('Google Picker is unavailable.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins &&
    window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[
          window.location.ancestorOrigins.length - 1
        ]
      : window.location.origin;

  return new Promise<PickedSpreadsheet | null>((resolve) => {
    const spreadsheetsView = new googleGlobal.picker.DocsView(
      googleGlobal.picker.ViewId.SPREADSHEETS
    );

    const picker = new googleGlobal.picker.PickerBuilder()
      .addView(spreadsheetsView)
      .setTitle('Choose a Google Spreadsheet')
      .setOAuthToken(accessToken)
      .setOrigin(pickerOrigin)
      .setCallback((data: PickerResponseData) => {
        if (data.action === googleGlobal.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (doc?.id) {
            resolve({
              spreadsheetId: doc.id,
              name: doc.name || 'Selected Spreadsheet',
            });
            return;
          }
          resolve(null);
        } else if (data.action === googleGlobal.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
