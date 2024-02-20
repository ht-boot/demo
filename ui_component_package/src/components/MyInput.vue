<template>
  <div class="my-input">
    <el-input v-bind="$attrs">
      <!-- 进行遍历，生成对应的插槽 -->
      <template v-for="(_item, name, i) in slots" #[name]="scopedData" :key="i">
        <slot :name="name" v-bind="scopedData"> </slot>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
// 获取父组件使用的插槽
import { useSlots } from "vue";

const slots = useSlots();
</script>
