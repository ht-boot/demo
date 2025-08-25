import sparkMD5 from "spark-md5";

/**
 * 将 File 转成 ArrayBuffer，并计算其哈希值
 * @param {Blob[]} chunks - 分片数组
 * @returns {Promise<string>} 文件哈希值
 */
const createHash = (chunks: Blob[], CHUNK_SIZE: number): Promise<string> => {
  return new Promise((resolve) => {
    const spark = new sparkMD5.ArrayBuffer(); // 初始化MD5计算器
    const fileReader = new FileReader(); // 用于读取Blob内容
    const targets: BlobPart[] | undefined = []; // 存放抽样的片段

    // 抽样策略：首尾分片全量，中间分片取3个2字节片段（共6字节）
    chunks.forEach((chunk, index) => {
      if (index === 0 || index === chunks.length - 1) {
        // 首尾分片：全量加入抽样
        targets.push(chunk);
      } else {
        // 中间分片：取前2字节、中间2字节、后2字节，
        // 会有一定概率导致修改文件重新计算的哈希值与旧哈希值一样，如果重新计算的哈希值不一样，就会导致所有的片段重新上传
        targets.push(chunk.slice(0, 2));
        targets.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2));
        targets.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE));
      }
    });

    // 读取抽样片段并计算哈希
    fileReader.readAsArrayBuffer(new Blob(targets));
    fileReader.onload = (e) => {
      const result = e.target?.result;
      if (!result || typeof result === "string") return;
      spark.append(result); // 累加数据
      resolve(spark.end()); // 生成最终哈希值
    };
  });
};

export default createHash;
