/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ChakraProvider } from '@chakra-ui/react';

import theme from './theme.ts';

const systemMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const colorMode = localStorage.getItem('chakra-ui-color-mode') || systemMode;

const root = document.getElementById('root');

ReactDOM.createRoot(root!).render(
  <>
    {localStorage.setItem('chakra-ui-color-mode', colorMode)}
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </>
);
