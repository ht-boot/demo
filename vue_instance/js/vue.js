// 创建vue实例
class Vue {
  constructor(vm_instance) {
    this.$data = vm_instance.data;
    Observer(vm_instance.data);
    Compile(vm_instance.el, this);
  }
}

// 实现数据劫持 - 监听实例里的数据 data
function Observer(data_instance) {
  // 退出递归
  if (!data_instance || typeof data_instance !== "object") return;
  // 创建依赖
  const depend = new Dependency();
  // 遍历data里的数据
  Object.keys(data_instance).forEach((key) => {
    // 递归， 完成 data 子属性实现数据劫持
    let value = data_instance[key];
    Observer(value);
    // 数据劫持
    Object.defineProperty(data_instance, key, {
      enumerable: true, // 可枚举
      configurable: true, // 属性可改变
      get() {
        console.log(`用户访问了${key}: ${value}`);
        // 将订阅者添加依赖
        Dependency.temp && depend.depend(Dependency.temp);
        console.log(Dependency.temp);
        return value;
      },
      set(newValue) {
        console.log(`用户修改了 ${key} 值`);
        value = newValue;
        // 将修改的属性进行劫持
        Observer(newValue);
        // 依赖更新
        depend.notify();
      },
    });
  });
}

// HTML 模板解析, 替换DOM 内地特殊语法
function Compile(element, vm) {
  // 获取 #app DOM
  vm.$el = document.querySelector(element);
  // 创建文档碎片
  let fragment = document.createDocumentFragment();

  let child;
  while ((child = vm.$el.firstChild)) {
    // fragment片段会将vm.$el上的子节点添加上去，vm.$el自身子节点会减少。
    fragment.append(child);
  }

  fragment_compile(fragment);
  // 替换文档碎片内容
  function fragment_compile(node) {
    // 匹配规则
    const pattren = /\{\{(\s*(\S+)\s*)\}\}/;
    // 文本节点
    if (node.nodeType === 3) {
      // 保存一个临时变量
      const temp = node.nodeValue;

      // 获取匹配结果
      const regex = pattren.exec(temp);
      // 排除匹配结果为null
      if (regex) {
        const result = regex[2]
          .split(".")
          .reduce(
            (accumulator, currentValue) => accumulator[currentValue],
            vm.$data
          );

        // 替换文本节点内容
        node.nodeValue = temp.replace(pattren, result);
        // 创建订阅者
        new Watcher(vm, regex[2], (newValue) => {
          node.nodeValue = temp.replace(pattren, newValue);
        });
      }
      return;
    }
    // 获取input元素节点， 实现v-model
    if (node.nodeType === 1 && node.nodeName.toLowerCase() === "input") {
      const attrArr = Array.from(node.attributes);
      attrArr.forEach((item) => {
        if (item.nodeName === "v-model") {
          const value = item.nodeValue
            .split(".")
            .reduce(
              (accumulator, currentValue) => accumulator[currentValue],
              vm.$data
            );
          node.value = value;
          new Watcher(vm, item.nodeValue, (newValue) => {
            node.value = newValue;
          });

          // input 事件
          node.addEventListener("input", (e) => {
            // [more, hobby]
            const firstArr = item.nodeValue.split(".");
            // [more]
            const secondArr = firstArr.slice(0, firstArr.length - 1);
            // vm.$data.more
            const finalArr = secondArr.reduce(
              (accumulator, currentValue) => accumulator[currentValue],
              vm.$data
            );

            finalArr[firstArr[firstArr.length - 1]] = e.target.value;
          });
        }
      });
    }
    // 遍历子节点并递归调用 fragment_compile
    node.childNodes.forEach((child) => fragment_compile(child));
  }
  // 将 fragment 片段添加到 vm.$el 中
  vm.$el.appendChild(fragment);
}

// 收集依赖 - 订阅者与通知着
class Dependency {
  constructor() {
    this.subscribers = [];
  }

  // 收集依赖
  depend(sub) {
    this.subscribers.push(sub);
  }

  // 通知更新
  notify() {
    this.subscribers.forEach((subscriber) => subscriber.update());
  }
}

/**
 * @description 订阅者
 * @vm vue实例
 * @key 变更的属性key值
 * @callback 回调函数
 */
class Watcher {
  constructor(vm, key, callback) {
    this.vm = vm;
    this.key = key;
    this.callback = callback;
    // 临时属性
    Dependency.temp = this;
    // 触发正确的getter
    key
      .split(".")
      .reduce(
        (accumulator, currentValue) => accumulator[currentValue],
        vm.$data
      );
    Dependency.temp = null;
  }
  // 更新数据
  update() {
    const value = this.key
      .split(".")
      .reduce(
        (accumulator, currentValue) => accumulator[currentValue],
        this.vm.$data
      );
    this.callback(value);
  }
}
