<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <HelloWorld msg="Vite + Vue" />

  // 二次封装组件 el-input
  <template v-for="n in 5000" :key="n">
    <MyInput a="1" b="232" c="3" v-model="text" v-if="defer(n)">
      <template #prepend>Http://</template>
      <template #append>{{ n }}</template>
    </MyInput>
  </template>
</template>

<script setup lang="ts">
import { ref } from "vue";
import HelloWorld from "./components/HelloWorld.vue";
import MyInput from "./components/MyInput.vue";
import { useDefer } from "./hooks/useDefer";

const defer = useDefer(100);
const text = ref("sss");
</script>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
