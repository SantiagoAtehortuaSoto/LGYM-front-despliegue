import { useCallback, useRef, useState } from "react";

export const useSubmitGuard = () => {
  const submitLockedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runGuardedSubmit = useCallback(async (task) => {
    if (submitLockedRef.current) {
      return false;
    }

    submitLockedRef.current = true;
    setIsSubmitting(true);

    try {
      await task();
      return true;
    } finally {
      submitLockedRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { runGuardedSubmit, isSubmitting };
};

export default useSubmitGuard;
