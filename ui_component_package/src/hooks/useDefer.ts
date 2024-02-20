import { ref, onUnmounted, getCurrentInstance } from "vue";
// 函数接收一个参数，表示监测的最大帧数，这里默认值是 1000
// 如果说你渲染的东西特别多可以传入一个值
export function useDefer(maxFrameCount = 1000) {
  // 然后开始计数
  const frameCount = ref(0);
  const instance = getCurrentInstance(); //获取当前实例对象，可以是 vm 对象或自定义实例

  console.log(instance);

  let rafId;
  const refreshFrameCount = () => {
    rafId = requestAnimationFrame(() => {
      // 每一次 requestAnimationFrame 就计数加一
      // 表示当前渲染的帧数变多了一帧
      frameCount.value++;

      // 只要当前帧数小于最大帧数就递归执行
      if (frameCount.value < maxFrameCount) {
        refreshFrameCount();
      } else {
        cancelAnimationFrame(rafId);
        return;
      }
    });
  };
  refreshFrameCount();

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
  }, instance);
  // 返回一个函数，接收传递进来的 n
  return function (showInFrameCount: number) {
    // 判断当前渲染的帧数有没有大于 n

    return frameCount.value >= showInFrameCount;
  };
}
