const STORAGE_KEY = "day-flow-tasks-v1";
const ENCOURAGEMENT_KEY = "day-flow-encouragement-v1";
const encouragements = [
  ["这里空空如也", "从一件小事开始，开启专注的一天。"],
  ["每一步都算数", "不必很快，保持向前就很好。"],
  ["今天也值得期待", "给自己一个小目标，然后认真完成它。"],
  ["慢慢来，也很棒", "专注眼前这一件事，答案会在路上出现。"],
  ["为自己加油", "你比想象中更有力量。"],
];
const defaultTasks = [
  { id: 1, text: "整理本周的工作计划", done: false },
  { id: 2, text: "回复重要邮件", done: true },
  { id: 3, text: "完成产品需求文档", done: false },
];

let tasks = loadTasks();
let currentFilter = "all";
let encouragementIndex = 0;

const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const summary = document.querySelector("#summary");
const progressRing = document.querySelector("#progressRing");
const progressValue = document.querySelector("#progressValue");
const encouragementTitle = document.querySelector("#encouragementTitle");
const encouragementText = document.querySelector("#encouragementText");
const encouragementForm = document.querySelector("#encouragementForm");
const encouragementInput = document.querySelector("#encouragementInput");

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultTasks;
  } catch { return defaultTasks; }
}

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

function updateEncouragement(value) {
  const [title, text] = value;
  encouragementTitle.textContent = title;
  encouragementText.textContent = text;
}

function loadEncouragement() {
  try {
    const custom = localStorage.getItem(ENCOURAGEMENT_KEY);
    if (custom) return ["给自己的一句话", custom];
  } catch { /* local storage unavailable */ }
  return encouragements[0];
}

function filteredTasks() {
  if (currentFilter === "active") return tasks.filter((task) => !task.done);
  if (currentFilter === "done") return tasks.filter((task) => task.done);
  return tasks;
}

function render() {
  const list = filteredTasks();
  taskList.innerHTML = "";
  list.forEach((task) => taskList.append(createTask(task)));
  emptyState.hidden = list.length > 0;
  taskList.hidden = list.length === 0;

  const complete = tasks.filter((task) => task.done).length;
  const active = tasks.length - complete;
  const percentage = tasks.length ? Math.round((complete / tasks.length) * 100) : 0;
  document.querySelector("#allCount").textContent = tasks.length;
  document.querySelector("#activeCount").textContent = active;
  document.querySelector("#doneCount").textContent = complete;
  summary.textContent = active ? `还剩 ${active} 项待完成` : tasks.length ? "全部完成，干得漂亮！" : "还没有任务";
  progressRing.style.setProperty("--progress", `${percentage}%`);
  progressValue.textContent = `${percentage}%`;
  saveTasks();
}

function createTask(task) {
  const item = document.createElement("li");
  item.className = `task${task.done ? " done" : ""}`;
  item.dataset.id = task.id;
  item.innerHTML = `
    <button class="task-check" type="button" aria-label="${task.done ? "标记为未完成" : "标记为已完成"}">✓</button>
    <span class="task-name" title="双击编辑">${escapeHtml(task.text)}</span>
    <button class="delete-task" type="button" aria-label="删除任务">×</button>`;
  item.querySelector(".task-check").addEventListener("click", () => toggleTask(task.id));
  item.querySelector(".delete-task").addEventListener("click", () => deleteTask(task.id));
  item.querySelector(".task-name").addEventListener("dblclick", () => editTask(item, task));
  return item;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function toggleTask(id) {
  tasks = tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task);
  render();
}

function deleteTask(id) { tasks = tasks.filter((task) => task.id !== id); render(); }

function editTask(item, task) {
  const label = item.querySelector(".task-name");
  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = task.text;
  input.maxLength = 80;
  label.replaceWith(input);
  input.focus();
  input.select();
  const finish = () => {
    const text = input.value.trim();
    if (text) tasks = tasks.map((entry) => entry.id === task.id ? { ...entry, text } : entry);
    render();
  };
  input.addEventListener("blur", finish, { once: true });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") render();
  });
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) { taskInput.focus(); return; }
  tasks.unshift({ id: Date.now(), text, done: false });
  taskInput.value = "";
  currentFilter = "all";
  setFilterButton();
  render();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    setFilterButton();
    render();
  });
});

function setFilterButton() {
  document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button.dataset.filter === currentFilter));
}

document.querySelector("#clearDone").addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.done);
  render();
});

document.querySelector("#changeEncouragement").addEventListener("click", () => {
  encouragementIndex = (encouragementIndex + 1) % encouragements.length;
  updateEncouragement(encouragements[encouragementIndex]);
});

document.querySelector("#editEncouragement").addEventListener("click", () => {
  encouragementForm.hidden = !encouragementForm.hidden;
  if (!encouragementForm.hidden) {
    encouragementInput.value = localStorage.getItem(ENCOURAGEMENT_KEY) || "";
    encouragementInput.focus();
  }
});

encouragementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = encouragementInput.value.trim();
  if (!text) return;
  localStorage.setItem(ENCOURAGEMENT_KEY, text);
  updateEncouragement(["给自己的一句话", text]);
  encouragementForm.hidden = true;
});

document.querySelector("#today").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
updateEncouragement(loadEncouragement());
render();
