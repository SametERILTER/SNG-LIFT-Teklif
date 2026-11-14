import 'react-native-reanimated';

// Polyfill DOMException for Hermes / React Native fetch error handling
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
