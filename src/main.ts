import { createApp } from "vue";
import "./styles/index.scss";
import "element-plus/dist/index.css";
import ElementPlus from "element-plus";
import App from "./App.vue";

createApp(App).use(ElementPlus).mount("#app");
