<script setup lang="ts">
import { ref } from "vue";
import { createFileChunks, CHUNK_SIZE } from "./utils/fileSlice";
import createHash from "./utils/createHash";

// 上传状态管理
const isUploading = ref(false); // 是否正在上传
const abortControllers = ref<AbortController[]>([]); // 存储所有请求的中断控制器
const fileHash = ref(""); // 文件哈希值
const fileName = ref(""); // 原始文件名（用于取后缀）
// 定义服务器返回的数据类型
interface VerifyResponse {
  data: {
    shouldUpload: boolean;
    existChunks: string[];
  };
}
/**
 * 向服务器校验文件状态
 * @returns {Promise<Object>} 校验结果（shouldUpload: 是否需要上传, existChunks: 已上传分片列表）
 */
const verify = async (): Promise<VerifyResponse> => {
  const res = await fetch("http://localhost:3000/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileHash: fileHash.value,
      fileName: fileName.value,
    }),
  });
  return res.json();
};

// 前端：请求合并分片的函数
const mergeRequest = async () => {
  await fetch("http://localhost:3000/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileHash: fileHash.value,
      fileName: fileName.value,
      size: CHUNK_SIZE, // 分片大小（用于计算写入位置）
    }),
  });

  // 合并完成后的清理
  isUploading.value = false;
  alert("文件上传完成！");
};

const handleUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (!target || !target.files) return; // 未选文件则退出
  const file = target.files[0]; // 获取用户选择的单个文件
  fileName.value = file.name;
  const chunks = createFileChunks(file);
  // console.log(chunks, 'chunks');
  fileName.value = file.name;
  fileHash.value = await createHash(chunks, CHUNK_SIZE); // 计算文件哈希

  // 发起校验
  const verifyRes = await verify();

  if (!verifyRes.data.shouldUpload) {
    // 服务器已存在完整文件 → 秒传成功
    alert("秒传成功！文件已存在");
    return;
  }

  // 需上传：进入分片上传环节
  await uploadChunks(chunks, verifyRes.data.existChunks);
};
/**
 * 上传分片
 * @param {Blob[]} chunks - 所有分片数组
 * @param {string[]} existChunks - 已上传的分片标识列表
 */
const uploadChunks = async (chunks: Blob[], existChunks: string[]) => {
  isUploading.value = true;
  abortControllers.value = []; // 清空历史中断控制器

  // 1. 生成所有分片的基础信息（文件哈希、分片标识、分片数据）
  const chunkInfoList = chunks.map((chunk, index) => ({
    fileHash: fileHash.value,
    chunkHash: `${fileHash.value}-${index}`, // 分片标识：文件哈希-序号（确保唯一）
    chunk: chunk,
  }));

  // 2. 过滤已上传的分片 → 只保留待上传的
  const formDatas = chunkInfoList
    .filter((item) => !existChunks.includes(item.chunkHash))
    .map((item) => {
      const formData = new FormData();
      formData.append("filehash", item.fileHash);
      formData.append("chunkhash", item.chunkHash);
      formData.append("chunk", item.chunk); // 分片二进制数据
      return formData;
    });

  if (formDatas.length === 0) {
    // 所有分片已上传 → 直接请求合并
    mergeRequest();
    return;
  }

  // 3. 并发上传分片
  await uploadWithConcurrencyControl(formDatas);
};

/**
 * 带并发控制的分片上传
 * @param {FormData[]} formDatas - 待上传的FormData列表
 */
const uploadWithConcurrencyControl = async (formDatas: FormData[]) => {
  const MAX_CONCURRENT = 6; // 最大并发数（可根据需求调整）
  let currentIndex = 0; // 当前待上传的分片索引
  const taskPool: Promise<void | Response>[] = []; // 存储当前正在执行的请求（请求池）
  while (currentIndex < formDatas.length) {
    // 为每个请求创建独立的中断控制器（AbortController）
    const controller = new AbortController();
    const { signal } = controller;
    abortControllers.value.push(controller); // 存入控制器列表

    // 发起分片上传请求
    const task = fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formDatas[currentIndex],
      signal: signal, // 绑定中断信号
    })
      .then((res) => {
        // 请求完成后，从请求池和控制器列表中移除
        taskPool.splice(taskPool.indexOf(task), 1);
        abortControllers.value = abortControllers.value.filter(
          (c) => c !== controller
        );
        return res;
      })
      .catch((err) => {
        // 捕获错误：区分「用户中断」和「其他错误」
        if (err.name !== "AbortError") {
          console.error("分片上传失败：", err);
          // 可在这里加「错误重试」逻辑（如重试3次）
        }
        // 无论何种错误，都清理状态
        taskPool.splice(taskPool.indexOf(task), 1);
        abortControllers.value = abortControllers.value.filter(
          (c) => c !== controller
        );
      });

    taskPool.push(task);

    // 当请求池满了，等待最快完成的一个请求再继续（释放并发名额）
    if (taskPool.length === MAX_CONCURRENT) {
      await Promise.race(taskPool);
    }

    currentIndex++;
  }

  // 等待所有剩余请求完成
  await Promise.all(taskPool);
  // 所有分片上传完成 → 请求合并
  mergeRequest();
};

/**
 * 中断上传（用户触发）
 */
const handleAbortUpload = () => {
  if (!isUploading.value) return;

  // 1. 中断所有正在进行的请求
  abortControllers.value.forEach((controller) => {
    controller.abort(); // 调用中断方法，触发请求的AbortError
  });

  // 2. 清理状态
  abortControllers.value = [];
  isUploading.value = false;

  // 3. 通知用户
  alert("上传已中断，下次可继续上传");
};
</script>

<template>
  <div class="upload-container">
    <h2>大文件上传演示</h2>
    <input @change="handleUpload" type="file" class="file-input" />
    <!-- 上传中才显示中断按钮 -->
    <button @click="handleAbortUpload" v-if="isUploading" class="abort-btn">
      中断上传
    </button>
  </div>
</template>

<style scoped></style>
