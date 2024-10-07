/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';

import theme from './theme.ts';

const root = document.getElementById('root');
ReactDOM.createRoot(root!).render(
  <>
    <ColorModeScript initialColorMode={theme.initialColorMode} />
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </>
);
