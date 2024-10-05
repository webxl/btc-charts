import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ChakraProvider, ColorModeProvider } from '@chakra-ui/react';
import theme from './theme.ts';

import React from 'react';

const root = document.getElementById('root');

ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeProvider>
        <App />
      </ColorModeProvider>
    </ChakraProvider>
  </React.StrictMode>
);
