const express = require("express");
const path = require("path");
const fse = require("fs-extra"); // 文件操作工具（比原生fs更易用）
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors()); // 解决跨域
app.use(bodyParser.json()); // 解析JSON请求体

// 上传根目录（所有分片和完整文件都存在这里）
const UPLOAD_DIR = path.resolve(__dirname, "uploads");
// 确保上传目录存在
fse.ensureDirSync(UPLOAD_DIR);

/**
 * 提取文件名后缀（如："test.pdf" → ".pdf"）
 * @param {string} fileName - 原始文件名
 * @returns {string} 文件后缀
 */
const extractExt = (fileName) => {
  return fileName.slice(fileName.lastIndexOf("."));
};

app.get("/", (req, res) => {
  res.send("欢迎使用文件上传服务");
});

// 校验接口：/verify
app.post("/verify", async (req, res) => {
  const { fileHash, fileName } = req.body;
  // 完整文件路径 = 上传目录 + 文件哈希 + 原文件后缀（确保文件名唯一）
  const completeFilePath = path.resolve(
    UPLOAD_DIR,
    `${fileHash}${extractExt(fileName)}`
  );

  // 1. 检查完整文件是否存在 → 秒传逻辑
  if (fse.existsSync(completeFilePath)) {
    return res.json({
      status: true,
      data: { shouldUpload: false }, // 无需上传
    });
  }

  // 2. 检查已上传的分片 → 断点续传逻辑
  const chunkDir = path.resolve(UPLOAD_DIR, fileHash); // 分片临时目录（用文件哈希命名）
  const existChunks = fse.existsSync(chunkDir)
    ? await fse.readdir(chunkDir) // 已上传的分片列表（如：["a1b2-0", "a1b2-1"]）
    : [];

  res.json({
    status: true,
    data: {
      shouldUpload: true, // 需要上传
      existChunks: existChunks, // 已上传的分片标识，供前端过滤
    },
  });
});

// 后端：/merge 接口（合并分片）
app.post("/merge", async (req, res) => {
  const { fileHash, fileName, size: CHUNK_SIZE } = req.body;
  // 完整文件路径（上传目录 + 文件哈希 + 后缀）
  const completeFilePath = path.resolve(
    UPLOAD_DIR,
    `${fileHash}${extractExt(fileName)}`
  );
  // 分片临时目录
  const chunkDir = path.resolve(UPLOAD_DIR, fileHash);

  // 检查分片目录是否存在（防止恶意请求）
  if (!fse.existsSync(chunkDir)) {
    return res.status(400).json({ status: false, message: "分片目录不存在" });
  }

  // 1. 读取所有分片并按序号排序
  const chunkPaths = await fse.readdir(chunkDir);
  chunkPaths.sort((a, b) => {
    // 从分片标识中提取序号（如："a1b2-0" → 0）
    return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
  });

  // 2. 用流拼接分片（边读边写，低内存占用）
  const mergePromises = chunkPaths.map((chunkName, index) => {
    return new Promise((resolve) => {
      const chunkPath = path.resolve(chunkDir, chunkName);
      const readStream = fse.createReadStream(chunkPath); // 分片读流
      const writeStream = fse.createWriteStream(completeFilePath, {
        start: index * CHUNK_SIZE, // 写入起始位置（精确到字节）
        end: (index + 1) * CHUNK_SIZE, // 写入结束位置
      });

      // 分片读取完成后：删除分片文件 +  resolve
      readStream.on("end", async () => {
        await fse.unlink(chunkPath); // 删除单个分片
        resolve();
      });

      // 管道流：将分片内容写入完整文件
      readStream.pipe(writeStream);
    });
  });

  // 3. 等待所有分片合并完成
  await Promise.all(mergePromises);
  // 4. 删除分片临时目录（合并完成后清理）
  await fse.remove(chunkDir);

  // 响应前端：合并成功
  res.json({ status: true, message: "文件合并成功" });
});

// 后端：/upload 接口（接收分片）
const multiparty = require("multiparty");

app.post("/upload", (req, res) => {
  const form = new multiparty.Form(); // 解析FormData的工具

  // 解析请求（fields：普通字段，files：文件字段）
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("分片解析失败：", err);
      return res.status(400).json({ status: false, message: "分片上传失败" });
    }

    // 提取字段
    const fileHash = fields["filehash"][0]; // 文件哈希
    const chunkHash = fields["chunkhash"][0]; // 分片标识
    const chunkFile = files["chunk"][0]; // 分片临时文件（multiparty生成的临时文件）

    // 分片临时目录（如：uploads/a1b2c3）
    const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
    // 确保临时目录存在
    await fse.ensureDir(chunkDir);

    // 目标路径：将分片从临时位置移动到临时目录
    const targetChunkPath = path.resolve(chunkDir, chunkHash);
    await fse.move(chunkFile.path, targetChunkPath);

    // 响应前端：分片上传成功
    res.json({ status: true, message: "分片上传成功" });
  });
});

// 启动服务器
app.listen(3000, () => {
  console.log("服务器运行在 http://localhost:3000");
});