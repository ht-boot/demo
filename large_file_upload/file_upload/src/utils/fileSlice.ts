/**
 * 文件分片工具
 * @param {File} file - 用户选择的文件
 * @returns {Blob[]} 分片数组
 */

// 分片大小：1MB
const CHUNK_SIZE = 1024 * 1024;
const createFileChunks = (file: {
  size: number;
  slice: (arg0: number, arg1: number) => any;
}) => {
  let current = 0; // 当前切割位置
  let fileChunks = [];
  while (current < file.size) {
    // 从当前位置切割到(当前位置+分片大小)，可能最后一片不足1MB
    const blob = file.slice(current, current + CHUNK_SIZE);
    fileChunks.push(blob);
    current += CHUNK_SIZE;
  }
  return fileChunks;
};

export { createFileChunks, CHUNK_SIZE };
