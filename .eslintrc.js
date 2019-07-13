module.exports = {
    "env": {
        "node": true,
        "commonjs": true,
        "es6": true
    },
    "extends": "standard",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
      "no-multiple-empty-lines": [2, { "max": 2 }],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],
      'object-property-newline': 'off',
    }
};