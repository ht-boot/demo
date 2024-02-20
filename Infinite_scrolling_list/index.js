const ul = document.querySelector("ul");
const lis = document.querySelectorAll("li");

const cloneLi = lis[0].cloneNode(true);

ul.appendChild(cloneLi);

const height = ul.offsetHeight / (lis.length + 1);

let current = 0;
let timer = null;

const scroll = () => {
  clearInterval(timer);
  timer = setInterval(() => {
    current++;
    ul.style.transition = "all 0.5s ease-in-out";
    if (current === 5) {
      // 这里的定时器是消除0.5s 的过渡效果， 然后切换为真数据。
      setTimeout(() => {
        current = 0;
        ul.style.transition = "none";
        ul.style.transform = `translateY(0px)`;
      }, 500);
    }
    ul.style.transform = `translateY(${-height * current}px)`;
  }, 1000);
};

scroll();

// 窗口切换 定时器清除
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    clearInterval(timer);
  } else {
    scroll();
  }
});
