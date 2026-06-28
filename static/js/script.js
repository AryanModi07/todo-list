(function () {
  const API = "/api/tasks";

  const form = document.getElementById('todo-form');
  const input = document.getElementById('task-input');
  const dueDateInput = document.getElementById('due-date-input');
  const errorMsg = document.getElementById('error-msg');
  const list = document.getElementById('task-list');
  const emptyMsg = document.getElementById('empty-msg');
  const countMsg = document.getElementById('count-msg');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const filterTabs = document.querySelectorAll('.filter-tab');

  // Stats widget elements
  const statTotal = document.getElementById('stat-total');
  const statActive = document.getElementById('stat-active');
  const statDone = document.getElementById('stat-done');
  const ringFg = document.getElementById('ring-fg');
  const ringPct = document.getElementById('ring-pct');
  const RING_CIRCUMFERENCE = 163.36;

  const confettiLayer = document.getElementById('confetti-layer');

  let currentFilter = 'all'; // 'all' | 'active' | 'completed'
  let draggedId = null;

  // ---------------------------------------------------------------
  // Animated number counting (used by the stats widget)
  // ---------------------------------------------------------------
  const lastValues = { total: 0, active: 0, done: 0 };
  function animateCount(el, from, to, duration = 400) {
    if (from === to) { el.textContent = to; return; }
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      el.textContent = value;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateStats(tasks) {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const active = total - done;

    animateCount(statTotal, lastValues.total, total);
    animateCount(statActive, lastValues.active, active);
    animateCount(statDone, lastValues.done, done);
    lastValues.total = total;
    lastValues.active = active;
    lastValues.done = done;

    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * pct) / 100;
    ringPct.textContent = `${pct}%`;

    clearCompletedBtn.disabled = done === 0;
  }

  // ---------------------------------------------------------------
  // Confetti burst
  // ---------------------------------------------------------------
  const CONFETTI_COLORS = ['#5b6cff', '#ff8fa3', '#7bd389', '#ffd166', '#8fd3ff'];
  function burstConfetti(big = false) {
    const count = big ? 80 : 28;
    const originX = window.innerWidth / 2;
    const originY = big ? window.innerHeight / 2 : window.innerHeight / 3;

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * (big ? 260 : 160);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 40;
      piece.style.setProperty('--dx', `${dx}px`);
      piece.style.setProperty('--dy', `${dy}px`);
      piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      piece.style.left = `${originX}px`;
      piece.style.top = `${originY}px`;
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
      confettiLayer.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
    }
  }

  // ---------------------------------------------------------------
  // Animated custom alert dialog (replaces native alert())
  // ---------------------------------------------------------------
  const modalOverlay = document.getElementById('modal-overlay');
  const modalMessage = document.getElementById('modal-message');
  const modalOkBtn = document.getElementById('modal-ok-btn');
  let modalResolve = null;

  function showAlert(message) {
    return new Promise((resolve) => {
      modalMessage.textContent = message;
      modalOverlay.classList.add('show');
      modalResolve = resolve;
      modalOkBtn.focus();
    });
  }
  function closeModal() {
    modalOverlay.classList.remove('show');
    if (modalResolve) {
      modalResolve();
      modalResolve = null;
    }
  }
  modalOkBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('show')) closeModal();
  });

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add('visible');
  }
  function clearError() {
    errorMsg.textContent = '';
    errorMsg.classList.remove('visible');
  }

  // ---------------------------------------------------------------
  // Date helpers (for overdue highlighting + badge formatting)
  // ---------------------------------------------------------------
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isOverdue(task) {
    return !!task.due_date && !task.completed && task.due_date < todayISO();
  }
  function formatDueDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ---------------------------------------------------------------
  // All data operations go through the Python (Flask) backend.
  // ---------------------------------------------------------------
  async function apiGetTasks() {
    const res = await fetch(API);
    return res.json();
  }
  async function apiAddTask(text, dueDate) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, due_date: dueDate || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add task.');
    return data;
  }
  async function apiToggleTask(id) {
    const res = await fetch(`${API}/${id}/toggle`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update task.');
    return data;
  }
  async function apiUpdateTask(id, text, dueDate) {
    const res = await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, due_date: dueDate || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update task.');
    return data;
  }
  async function apiDeleteTask(id) {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete task.');
    return data;
  }
  async function apiClearCompleted() {
    const res = await fetch(`${API}/completed`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear completed tasks.');
    return data;
  }
  async function apiReorderTasks(orderedIds) {
    const res = await fetch(`${API}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reorder tasks.');
    return data;
  }

  // ---------------------------------------------------------------
  // Filter tabs
  // ---------------------------------------------------------------
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      filterTabs.forEach(t => t.classList.toggle('active', t === tab));
      render();
    });
  });

  function applyFilter(tasks) {
    if (currentFilter === 'active') return tasks.filter(t => !t.completed);
    if (currentFilter === 'completed') return tasks.filter(t => t.completed);
    return tasks;
  }

  // ---------------------------------------------------------------
  // Clear completed
  // ---------------------------------------------------------------
  clearCompletedBtn.addEventListener('click', async () => {
    const doneLis = list.querySelectorAll('li.completed');
    doneLis.forEach(li => li.classList.add('task-out'));
    try {
      await new Promise(resolve => setTimeout(resolve, doneLis.length ? 300 : 0));
      const result = await apiClearCompleted();
      await showAlert(result.deleted.length
        ? `Cleared ${result.deleted.length} completed task(s).`
        : 'No completed tasks to clear.');
      render();
    } catch (err) {
      await showAlert('Error: ' + err.message);
    }
  });

  // ---------------------------------------------------------------
  // Drag-and-drop reordering
  // ---------------------------------------------------------------
  function attachDragHandlers(li, task, dragHandle) {
    li.draggable = false; // only the handle initiates drag
    dragHandle.addEventListener('mousedown', () => { li.draggable = true; });
    dragHandle.addEventListener('touchstart', () => { li.draggable = true; }, { passive: true });

    li.addEventListener('dragstart', (e) => {
      draggedId = task.id;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(task.id));
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      li.draggable = false;
      document.querySelectorAll('li.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (task.id !== draggedId) li.classList.add('drag-over');
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });

    li.addEventListener('drop', async (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      if (draggedId === null || draggedId === task.id) return;

      const currentIds = Array.from(list.children).map(node => Number(node.dataset.taskId));
      const fromIndex = currentIds.indexOf(draggedId);
      const toIndex = currentIds.indexOf(task.id);
      if (fromIndex === -1 || toIndex === -1) return;

      currentIds.splice(toIndex, 0, currentIds.splice(fromIndex, 1)[0]);

      try {
        await apiReorderTasks(currentIds);
        render();
      } catch (err) {
        await showAlert('Error: ' + err.message);
      }
    });
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------
  async function render() {
    let allTasks;
    try {
      allTasks = await apiGetTasks();
    } catch (err) {
      await showAlert('Could not reach the server: ' + err.message);
      return;
    }

    updateStats(allTasks);

    const visibleTasks = applyFilter(allTasks);
    list.innerHTML = '';
    emptyMsg.style.display = visibleTasks.length === 0 ? 'block' : 'none';
    emptyMsg.textContent = allTasks.length === 0
      ? 'No tasks yet. Add one above!'
      : `No ${currentFilter === 'all' ? '' : currentFilter} tasks here.`;

    visibleTasks.forEach(task => {
      const li = document.createElement('li');
      li.dataset.taskId = task.id;
      if (task.completed) li.classList.add('completed');
      if (isOverdue(task)) li.classList.add('overdue');

      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.title = 'Drag to reorder';
      dragHandle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/>
        <circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/>
        <circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>
      </svg>`;

      const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkmark.setAttribute('viewBox', '0 0 24 24');
      checkmark.setAttribute('class', 'task-checkmark');
      const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkPath.setAttribute('d', 'M5 13l4 4L19 7');
      checkmark.appendChild(checkPath);

      const textWrap = document.createElement('span');
      textWrap.className = 'task-text-wrap';
      textWrap.textContent = task.text;
      textWrap.title = 'Double-click to edit';
      textWrap.addEventListener('dblclick', () => startEdit(li, task));

      const span = document.createElement('span');
      span.style.flex = '1';
      span.style.display = 'flex';
      span.style.alignItems = 'center';
      span.style.gap = '8px';
      span.appendChild(checkmark);
      span.appendChild(textWrap);

      if (task.due_date) {
        const badge = document.createElement('span');
        badge.className = 'due-badge';
        badge.textContent = (isOverdue(task) ? 'Overdue: ' : 'Due ') + formatDueDate(task.due_date);
        span.appendChild(badge);
      }

      const completeBtn = document.createElement('button');
      completeBtn.type = 'button';
      completeBtn.textContent = task.completed ? 'Undo' : 'Complete';
      completeBtn.className = 'complete-btn';
      completeBtn.addEventListener('click', async () => {
        try {
          const updated = await apiToggleTask(task.id);
          if (updated.completed) {
            const remainingActive = (lastValues.active - 1);
            burstConfetti(remainingActive <= 0);
          }
          await showAlert(updated.completed ? `Task completed: "${updated.text}"` : `Marked back to do: "${updated.text}"`);
          render();
        } catch (err) {
          await showAlert('Error: ' + err.message);
        }
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'remove-btn';
      removeBtn.addEventListener('click', async () => {
        try {
          li.classList.add('task-out');
          await new Promise(resolve => setTimeout(resolve, 300));
          await apiDeleteTask(task.id);
          await showAlert(`Task removed: "${task.text}"`);
          render();
        } catch (err) {
          await showAlert('Error: ' + err.message);
        }
      });

      li.appendChild(dragHandle);
      li.appendChild(span);
      li.appendChild(completeBtn);
      li.appendChild(removeBtn);
      list.appendChild(li);

      attachDragHandlers(li, task, dragHandle);
    });

    const activeCount = allTasks.filter(t => !t.completed).length;
    countMsg.textContent = allTasks.length === 0
      ? ''
      : `${activeCount} of ${allTasks.length} task(s) remaining`;
  }

  function startEdit(li, task) {
    li.innerHTML = '';

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = task.text;
    editInput.maxLength = 100;
    editInput.className = 'edit-input';

    const editDate = document.createElement('input');
    editDate.type = 'date';
    editDate.value = task.due_date || '';
    editDate.className = 'due-date-input';
    editDate.style.maxWidth = '120px';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.className = 'complete-btn';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'remove-btn';

    async function save() {
      const newText = editInput.value;
      const newDueDate = editDate.value;
      try {
        const oldText = task.text;
        const updated = await apiUpdateTask(task.id, newText, newDueDate);
        await showAlert(`Task updated:\n"${oldText}" -> "${updated.text}"`);
        render();
      } catch (err) {
        await showAlert(err.message);
        editInput.focus();
      }
    }

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', () => render());
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        render();
      }
    });

    li.appendChild(editInput);
    li.appendChild(editDate);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);
    editInput.focus();
    editInput.select();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value;
    const dueDateValue = dueDateInput.value;

    try {
      clearError();
      const task = await apiAddTask(value, dueDateValue);
      await showAlert(`Task added: "${task.text}"`);
      input.value = '';
      dueDateInput.value = '';
      input.focus();
      render();
    } catch (err) {
      showError(err.message);
      input.classList.remove('shake');
      // restart animation in case of rapid repeated errors
      void input.offsetWidth;
      input.classList.add('shake');
      await showAlert(err.message);
      input.focus();
    }
  });

  input.addEventListener('animationend', () => {
    input.classList.remove('shake');
  });

  input.addEventListener('input', () => {
    if (errorMsg.classList.contains('visible')) clearError();
  });

  render();
})();
