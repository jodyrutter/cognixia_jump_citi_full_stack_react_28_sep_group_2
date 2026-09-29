export interface ActingAs {
  user_id: number;
  name: string;
  role: "admin" | "customer";
}

const STORAGE_KEY = "banking_console_acting_as";
const CHANGE_EVENT = "banking-console:acting-as-changed";

function read(): ActingAs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActingAs;
  } catch {
    return null;
  }
}

function write(value: ActingAs | null) {
  if (value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const actingAsStore = {
  get(): ActingAs | null {
    return read();
  },
  set(value: ActingAs) {
    write(value);
  },
  clear() {
    write(null);
  },
  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  },
};
