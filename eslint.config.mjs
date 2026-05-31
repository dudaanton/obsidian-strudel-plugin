import obsidianmd from "eslint-plugin-obsidianmd";
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "main.js",
      "src/strudel/**",
      "src/assets/**",
      "docker-formatter.*",
    ],
  },

  ...obsidianmd.configs.recommended,

  // Workaround: obsidianmd recommended preset declares the typed rule
  // `no-plugin-as-component` globally, which crashes on non-TS files
  // (it calls getParserServices). Disable it for everything except TS.
  {
    files: ["**/*.json", "**/*.vue", "**/*.js", "**/*.mjs", "**/*.cjs"],
    rules: {
      "obsidianmd/no-plugin-as-component": "off",
    },
  },

  // Preserve product/acronym casing in UI strings. `ignoreWords` is
  // case-sensitive, so list every form that appears in source.
  {
    rules: {
      "obsidianmd/ui/sentence-case": [
        "error",
        {
          enforceCamelCaseLower: true,
          ignoreWords: ["Strudel", "strudel", "REPL", "repl", "URLs", "urls", "URL", "url"],
        },
      ],
    },
  },

  ...vue.configs["flat/recommended"],

  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
    },
  },

  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  prettierRecommended,

  // Generic rules — apply to all linted files
  {
    rules: {
      "arrow-body-style": 0,
      "class-methods-use-this": 0,
      "comma-dangle": 0,
      "func-names": 0,
      "linebreak-style": 0,
      "max-len": [
        "warn",
        {
          code: 120,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreStrings: true,
        },
      ],
      "no-await-in-loop": 0,
      "no-console": 0,
      "no-loop-func": 0,
      "no-mixed-operators": 0,
      "no-param-reassign": 0,
      "no-restricted-syntax": 0,
      "no-shadow": 0,
      "no-trailing-spaces": 1,
      "no-underscore-dangle": 0,
      "no-use-before-define": 0,
      "prefer-destructuring": 0,
      semi: 0,
      "space-before-function-paren": 0,
      "prettier/prettier": ["warn"],
    },
  },

  // Vue rules — apply only to .vue files
  {
    files: ["**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-dupe-keys": "warn",
      "vue/no-mutating-props": ["warn", { shallowOnly: true }],
      "vue/no-unused-vars": ["warn", { ignorePattern: "^_" }],
      "vue/no-use-v-if-with-v-for": "warn",
      "vue/prop-name-casing": "error",
      "vue/return-in-computed-property": "off",
      "vue/require-prop-types": "error",
      "vue/require-toggle-inside-transition": "warn",
      "vue/require-typed-object-prop": "error",
      "vue/require-v-for-key": "warn",
      "vue/valid-v-for": "warn",
    },
  },

  // TS rules — apply only where @typescript-eslint plugin is registered
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-explicit-any": 0,
      "@typescript-eslint/no-inferrable-types": ["warn", { ignoreParameters: true }],
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
