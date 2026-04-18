import { useState, useEffect, useCallback, useRef } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return [storedValue, setValue];
}

export function useTypewriter(text, speed = 50) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;

    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return displayedText;
}

export function useAnimatedPlaceholder(examples, interval = 3000) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = examples[index % examples.length];

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (displayed.length < currentText.length) {
          setDisplayed(currentText.slice(0, displayed.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        if (displayed.length > 0) {
          setDisplayed(currentText.slice(0, displayed.length - 1));
        } else {
          setIsDeleting(false);
          setIndex((prev) => (prev + 1) % examples.length);
        }
      }
    }, isDeleting ? 30 : 50);

    return () => clearTimeout(timer);
  }, [displayed, isDeleting, index, examples, interval]);

  return displayed;
}
