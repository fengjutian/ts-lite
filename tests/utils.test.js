import { describe, it, expect } from 'vitest';
import { add, isEven, greet } from '../src/utils.js';

describe('工具函数测试', () => {
  describe('add 函数', () => {
    it('应该正确计算两个数字的和', () => {
      expect(add(1, 2)).toBe(3);
      expect(add(-1, 1)).toBe(0);
      expect(add(0, 0)).toBe(0);
      expect(add(100, 200)).toBe(300);
    });
    
    it('应该正确处理非数字输入', () => {
      expect(add('1', '2')).toBe('12'); // 字符串拼接
      expect(add(1, '2')).toBe('12'); // 类型转换
    });
  });
  
  describe('isEven 函数', () => {
    it('应该正确判断偶数', () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(0)).toBe(true);
      expect(isEven(-2)).toBe(true);
      expect(isEven(100)).toBe(true);
    });
    
    it('应该正确判断奇数', () => {
      expect(isEven(1)).toBe(false);
      expect(isEven(-1)).toBe(false);
      expect(isEven(99)).toBe(false);
    });
  });
  
  describe('greet 函数', () => {
    it('应该正确生成问候语', () => {
      expect(greet('Alice')).toBe('Hello, Alice!');
      expect(greet('Bob')).toBe('Hello, Bob!');
      expect(greet('')).toBe('Hello, !');
    });
    
    it('应该正确处理非字符串输入', () => {
      expect(greet(123)).toBe('Hello, 123!');
      expect(greet(null)).toBe('Hello, null!');
      expect(greet(undefined)).toBe('Hello, undefined!');
    });
  });
});