module.exports = {
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
  extends: ['prettier'],
  plugins: ['prettier', 'tsdoc'],
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', 'perf/', 'fixtures'],
  rules: {
    'no-undef': 'off',
    'no-empty': 'off',
    'sort-keys': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-arrow/prefer-arrow-functions': 'off',
    'prefer-rest-params': 'off',

    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        tabWidth: 2,
        printWidth: 100,
        trailingComma: 'es5',
      },
    ],
  },

  overrides: [
    {
      files: ['*.ts', '*.mts'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/explicit-member-accessibility': 'off',
        '@typescript-eslint/no-object-literal-type-assertion': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-misused-new': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/array-type': 'off',
        'tsdoc/syntax': 'error',

        'no-restricted-syntax': [
          'error',
          {
            selector: 'PropertyDefinition[value]',
            message: 'Property definitions with value initializers aren’t transpiled',
          },
          {
            selector: 'MemberExpression[optional=true]',
            message: 'Optional chaining (?.) operator is outside of specified browser support',
          },
          {
            selector: 'LogicalExpression[operator="??"]',
            message: 'Nullish coalescing (??) operator is outside of specified browser support',
          },
          {
            selector: 'AssignmentExpression[operator="??="]',
            message: 'Nullish coalescing assignment (??=) is outside of specified browser support',
          },
          {
            selector: 'SequenceExpression',
            message: 'Sequence expressions are to be avoided since they can be confusing',
          },
          {
            selector: ':not(ForStatement) > VariableDeclaration[declarations.length>1]',
            message: 'Only one variable declarator per variable declaration is preferred',
          },
        ],

        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            disallowTypeAnnotations: false,
            fixStyle: 'separate-type-imports',
          },
        ],
      },
    },

    {
      files: ['packages/cli-utils/**/*.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },

    {
      files: ['src/**/__tests__/**/*.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },

    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
  ],
};
