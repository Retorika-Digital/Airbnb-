import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONATE_URL, donateUrl } from '../../js/config.js';

test('sin enlace de donaciones no sale ningún botón', () => {
  assert.equal(typeof DONATE_URL, 'string');
  assert.equal(donateUrl(''), '');
});

test('el enlace de donaciones solo vale si es https de verdad', () => {
  assert.equal(donateUrl('https://ko-fi.com/disketeboy'), 'https://ko-fi.com/disketeboy');
  assert.equal(donateUrl('http://ko-fi.com/disketeboy'), '', 'sin cifrar, no');
  assert.equal(donateUrl('javascript:alert(1)'), '');
  assert.equal(donateUrl('ko-fi.com/disketeboy'), '', 'sin https:// delante no es un enlace');
});
