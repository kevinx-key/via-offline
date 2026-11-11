import {THEMES as REMOTETHEMES} from '@the-via/reader';
import {KeyColorPair} from 'src/types/keyboard-rendering';

export type Theme = {
  alpha: KeyColorPair;
  mod: KeyColorPair;
  accent: KeyColorPair;
};

export const THEMES = {
  ...{
    // 山紫云白：奶白键帽 + 紫色字符 / 紫色大键，白色定位板
    // 白天默认：GMK Olivia 经典奶白 + 炭黑 + 藕粉
    OLIVIA: {
      alpha: {c: '#e9e0d4', t: '#363434'},
      mod: {c: '#363434', t: '#e8c4b8'},
      accent: {c: '#e8c4b8', t: '#363434'},
    },
    // 黑白：紫韵的紫色位全部换黑
    HEIBAI: {
      alpha: {c: '#f2f7fd', t: '#14161b'},
      mod: {c: '#1b1d23', t: '#f7faff'},
      accent: {c: '#2b2e36', t: '#ffffff'},
    },
    // 蓝白：紫韵的紫色位全部换品牌蓝
    LANBAI: {
      alpha: {c: '#f2f7fd', t: '#0071e3'},
      mod: {c: '#0071e3', t: '#ffffff'},
      accent: {c: '#0071e3', t: '#ffffff'},
    },
    ZIYUN: {
      // 紫韵：冷白键帽 + 紫中带蓝的字符；比纯蓝紫保留更多紫色。
      alpha: {c: '#f2f7fd', t: '#533892'},
      mod: {c: '#623faa', t: '#f7faff'},
      accent: {c: '#724cbb', t: '#ffffff'},
    },
    // ERROR：深灰键帽 + 白字 / 红色警示大键，黑色定位板
    ERROR: {
      alpha: {c: '#34363f', t: '#f1f1f3'},
      mod: {c: '#202127', t: '#c9cbd1'},
      accent: {c: '#e84540', t: '#ffffff'},
    },
    STARTHOCK_LIGHT: {
      alpha: {c: '#e8e8ed', t: '#1d1d1f'},
      mod: {c: '#d2d2d7', t: '#1d1d1f'},
      accent: {c: '#0071e3', t: '#ffffff'},
    },
    STARTHOCK_DARK: {
      alpha: {c: '#2b303b', t: '#e6edf3'},
      mod: {c: '#1f242d', t: '#aab4c0'},
      accent: {c: '#58a6ff', t: '#0d1117'},
    },
    OLIVIA_DARK: {
      alpha: {
        c: '#363434',
        t: '#E8C4B8',
      },
      mod: {
        c: '#363434',
        t: '#E8C4B8',
      },
      accent: {
        c: '#E8C4B8',
        t: '#363434',
      },
    },
    OLIVE: {
      alpha: {
        t: '#66665A',
        c: '#D9D7C4',
      },
      mod: {
        c: '#66665A',
        t: '#9DA183',
      },
      accent: {
        c: '#9DA183',
        t: '#66665A',
      },
    },
    OLIVE_DARK: {
      alpha: {
        c: '#66665A',
        t: '#9DA183',
      },
      mod: {
        c: '#66665A',
        t: '#9DA183',
      },
      accent: {
        c: '#9DA183',
        t: '#66665A',
      },
    },
    OLNY: {
      alpha: {
        c: '#c20018',
        t: '#cfa174',
      },
      mod: {
        c: '#c20018',
        t: '#cfa174',
      },
      accent: {
        t: '#c20018',
        c: '#cfa174',
      },
    },
    GREG: {
      alpha: {
        c: '#f8c200',
        t: '#393b3b',
      },
      mod: {
        c: '#f7f2ea',
        t: '#393b3b',
      },
      accent: {
        c: '#171718',
        t: '#393b3b',
      },
    },
    CARBON_BLACK_A: {
      alpha: {
        c: '#788194',
        t: '#f3f3f3',
      },
      mod: {
        c: '#3b3b3e',
        t: '#f3f3f3',
      },
      accent: {
        c: '#e66b67',
        t: '#f3f3f3',
      },
    },
    CARBON_BLACK_B: {
      alpha: {
        c: '#3b3b3e',
        t: '#f3f3f3',
      },
      mod: {
        c: '#788194',
        t: '#f3f3f3',
      },
      accent: {
        c: '#e66b67',
        t: '#f3f3f3',
      },
    },
    SILVER_GREY_A: {
      alpha: {
        c: '#b2b3b8',
        t: '#f3f3f3',
      },
      mod: {
        c: '#838589',
        t: '#f3f3f3',
      },
      accent: {
        c: '#e8db5d',
        t: '#3d3125',
      },
    },
    SILVER_GREY_B: {
      alpha: {
        c: '#838589',
        t: '#f3f3f3',
      },
      mod: {
        c: '#b2b3b8',
        t: '#f3f3f3',
      },
      accent: {
        c: '#e8db5d',
        t: '#3d3125',
      },
    },
    NAVY_BLUE_A: {
      alpha: {
        c: '#547be8',
        t: '#f3f3f3',
      },
      mod: {
        c: '#49599f',
        t: '#f3f3f3',
      },
      accent: {
        c: '#4dcfe0',
        t: '#f3f3f3',
      },
    },
    NAVY_BLUE_B: {
      alpha: {
        c: '#49599f',
        t: '#f3f3f3',
      },
      mod: {
        c: '#547be8',
        t: '#f3f3f3',
      },
      accent: {
        c: '#4dcfe0',
        t: '#f3f3f3',
      },
    },
    FENDAI: {
      alpha: {
        c: '#f0ebec',
        t: '#07010f',
      },
      mod: {
        c: '#f0ebec',
        t: '#56395c',
      },
      accent: {
        c: '#fc5d75',
        t: '#56395c',
      },
    },
    HONEY_MILK: {
      alpha: {
        c: '#fffff8',
        t: '#07010f',
      },
      mod: {
        c: '#fffff8',
        t: '#07010f',
      },
      accent: {
        c: '#f8b140',
        t: '#07010f',
      },
    },
    MATCHA: {
      alpha: {
        c: '#e8e8df',
        t: '#4e475c',
      },
      mod: {
        c: '#828572',
        t: '#4e475c',
      },
      accent: {
        c: '#828572',
        t: '#4e475c',
      },
    },
    BLACK_GREY: {
      alpha: {
        c: '#7e8293',
        t: '#a5cbe6',
      },
      mod: {
        c: '#364352',
        t: '#eff3f2',
      },
      accent: {
        c: '#364352',
        t: '#eff3f2',
      },
    },
    WHITE_GREEN: {
      alpha: {
        c: '#fefefe',
        t: '#272727',
      },
      mod: {
        c: '#275c65',
        t: '#d0eae8',
      },
      accent: {
        c: '#275c65',
        t: '#d0eae8',
      },
    },
    WHITE: {
      alpha: {
        c: '#fefefe',
        t: '#272727',
      },
      mod: {
        c: '#fefefe',
        t: '#272727',
      },
      accent: {
        c: '#fefefe',
        t: '#272727',
      },
    },
    BLACK: {
      alpha: {
        c: '#272727',
        t: '#fefefe',
      },
      mod: {
        c: '#272727',
        t: '#fefefe',
      },
      accent: {
        c: '#272727',
        t: '#fefefe',
      },
    },
    BLACK_AND_WHITE: {
      alpha: {
        c: '#fefefe',
        t: '#272727',
      },
      mod: {
        c: '#272727',
        t: '#fefefe',
      },
      accent: {
        c: '#272727',
        t: '#fefefe',
      },
    },
    CLASSIC_GREY: {
      alpha: {
        c: '#fcfcfc',
        t: '#1a1a1a',
      },
      mod: {
        c: '#a0a0a0',
        t: '#1a1a1a',
      },
      accent: {
        c: '#a0a0a0',
        t: '#1a1a1a',
      },
    },
  },
  ...REMOTETHEMES,
};
