document.addEventListener('DOMContentLoaded', () => {
  // Charger l'ID actuel
  chrome.storage.local.get(['mdi_room_id'], (result) => {
    if (result.mdi_room_id) {
      document.getElementById('roomId').value = result.mdi_room_id;
    }
  });
  // Sauvegarder
  document.getElementById('saveBtn').addEventListener('click', () => {
    const id = document.getElementById('roomId').value.trim();
    if (id) {
      chrome.storage.local.set({ mdi_room_id: id }, () => {
        const status = document.getElementById('status');
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 2000);
      });
    }
  });
});
