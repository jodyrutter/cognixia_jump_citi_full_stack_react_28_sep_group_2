import { useEffect, useState } from "react";
import { actingAsStore, type ActingAs } from "./actingAsStore";

export function useActingAs() {
  const [actingAs, setActingAs] = useState<ActingAs | null>(() => actingAsStore.get());

  useEffect(() => {
    return actingAsStore.subscribe(() => setActingAs(actingAsStore.get()));
  }, []);

  return {
    actingAs,
    setActingAs: (v: ActingAs) => actingAsStore.set(v),
    clear: () => actingAsStore.clear(),
  };
}
