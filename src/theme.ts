import { DefaultTheme } from 'styled-components';
import { extendTheme } from '@chakra-ui/react';
import '@fontsource/brawler';
import '@fontsource/roboto';
import { checkboxAnatomy as parts } from '@chakra-ui/anatomy';
import { createMultiStyleConfigHelpers, defineStyle } from '@chakra-ui/styled-system';
import { theme as chakraTheme } from '@chakra-ui/theme';

// eslint-disable-next-line @typescript-eslint/unbound-method
const { definePartsStyle, defineMultiStyleConfig } = createMultiStyleConfigHelpers(parts.keys);

const baseStyle = definePartsStyle({});

const transparentAlertVariant = definePartsStyle(props => {
  return {
    container: {
      ...(chakraTheme.components.Alert.variants?.subtle?.(props)?.container || {}),
      bg: 'transparent'
    }
  };
});

const variantContrastBg = definePartsStyle(props => {
  const { colorMode } = props;

  return {
    control: defineStyle({
      backgroundColor: colorMode === 'dark' ? 'gray.900' : 'white',
      borderWidth: 1
    })
  };
});

const variants = {
  contrastBg: variantContrastBg
};

const sizes = {
  xl: definePartsStyle({
    control: defineStyle({
      boxSize: 14
    }),
    label: defineStyle({
      fontSize: '2xl',
      marginLeft: 6
    })
  })
};

export const checkboxTheme = defineMultiStyleConfig({
  baseStyle,
  variants,
  sizes
});

export const alertTheme = defineMultiStyleConfig({
  baseStyle,
  variants: {
    transparent: transparentAlertVariant
  }
});

const lightTheme: DefaultTheme = {
  background: '#ffffff',
  axis: {
    domain: {
      line: {
        strokeWidth: 0,
        stroke: '#889eae'
      }
    },
    ticks: {
      line: {
        strokeWidth: 1,
        stroke: '#889eae'
      },
      text: {
        fill: '#6a7c89',
        fontSize: 11
      }
    },
    legend: {
      text: {
        fill: '#6f6f6f',
        fontSize: 13,
        fontWeight: 600
      }
    }
  },
  legends: {
    text: {
      fontSize: 12
    },
    ticks: {
      line: {
        strokeWidth: 1,
        stroke: '#637079'
      },
      text: {
        fill: '#6a7c89',
        fontSize: 10
      }
    },
    title: {
      text: {
        fill: '#6f6f6f',
        fontSize: 10,
        fontWeight: 800
      }
    }
  },
  tooltip: {
    container: {
      fontSize: '13px',
      zIndex: 10000
    }
  },
  labels: {
    text: {
      fill: '#555555',
      fontWeight: 600
    }
  },
  annotations: {
    text: {
      fill: '#333333',
      outlineWidth: 1.5,
      outlineColor: '#ffffff',
      outlineOpacity: 0.35
    },
    link: {
      stroke: '#6c6363',
      strokeWidth: 1.5,
      outlineWidth: 2.5,
      outlineColor: '#ffffff',
      outlineOpacity: 0.35
    },
    outline: {
      stroke: '#6c6363',
      strokeWidth: 1.5,
      outlineWidth: 2.5,
      outlineColor: '#ffffff',
      outlineOpacity: 0.35
    },
    symbol: {
      fill: '#6c6363',
      outlineWidth: 2.5,
      outlineColor: '#ffffff',
      outlineOpacity: 0.35
    }
  }
};

const darkTheme: DefaultTheme = {
  // background: '#0e1317',
  axis: {
    domain: {
      line: {
        strokeWidth: 0,
        stroke: '#526271'
      }
    },
    ticks: {
      line: {
        strokeWidth: 1,
        stroke: '#526271'
      },
      text: {
        fill: '#8d9cab',
        fontSize: 11
      }
    },
    legend: {
      text: {
        fill: '#ccd7e2',
        fontSize: 13,
        fontWeight: 500
      }
    }
  },
  grid: {
    line: {
      stroke: '#444'
    }
  },
  legends: {
    text: {
      fontSize: 12,
      fill: '#8d9cab'
    },
    ticks: {
      line: {
        strokeWidth: 1,
        stroke: '#c8d4e0'
      },
      text: {
        fill: '#8d9cab',
        fontSize: 10
      }
    },
    title: {
      text: {
        fill: '#ccd7e2',
        fontSize: 10,
        fontWeight: 800
      }
    }
  },
  tooltip: {
    container: {
      fontSize: '13px',
      background: '#000',
      color: '#ddd',
      zIndex: 10000
    }
  },
  labels: {
    text: {
      fill: '#ddd',
      fontSize: 12,
      fontWeight: 500
    }
  },
  dots: {
    text: {
      fill: '#bbb',
      fontSize: 12
    }
  },
  annotations: {
    text: {
      fill: '#dddddd',
      outlineWidth: 1.5,
      outlineColor: '#0e1317',
      outlineOpacity: 0.35
    },
    link: {
      stroke: '#b2bfcb',
      strokeWidth: 1.5,
      outlineWidth: 2.5,
      outlineColor: '#0e1317',
      outlineOpacity: 0.35
    },
    outline: {
      stroke: '#b2bfcb',
      strokeWidth: 1.5,
      outlineWidth: 2.5,
      outlineColor: '#0e1317',
      outlineOpacity: 0.35
    },
    symbol: {
      fill: '#b2bfcb',
      outlineWidth: 2,
      outlineColor: '#0e1317',
      outlineOpacity: 0.35
    }
  },
  crosshair: {
    line: {
      stroke: '#b2bfcb',
      strokeWidth: 1
    }
  }
};

export const nivoThemes = {
  light: lightTheme,
  dark: darkTheme
};

const config = {
  initialColorMode: 'dark',
  fonts: {
    heading: `'Brawler',  sans-serif`,
    body: `'Roboto', sans-serif`,
    code: `'Roboto Mono', monospace`
  },
  components: {
    Checkbox: checkboxTheme,
    Alert: alertTheme,
    Tooltip: {
      baseStyle: {
        bg: 'gray.700',
        borderColor: 'white',
        borderWidth: 1,
        color: 'white',
        borderRadius: 'md',
        px: 2,
        py: 1,
        fontSize: 'sm',
        maxW: '320px',
        wordWrap: 'break-word',
        marginLeft: '10px'
      },
      defaultProps: {
        placement: 'auto',
        offset: [0, 8]
      }
    }
  }
};

const theme = extendTheme(config);

export default theme;
