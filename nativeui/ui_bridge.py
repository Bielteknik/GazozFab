import asyncio
from PySide6.QtCore import QObject, Signal, Property, Slot

class UIBridge(QObject):
    systemStateChanged = Signal()

    def __init__(self, db, hw, prod):
        super().__init__()
        self.db = db
        self.hw = hw
        self.prod = prod
        self._state = {}

    @Property(dict, notify=systemStateChanged)
    def systemState(self):
        return self._state

    def update_state(self):
        """Fetches the full state from main.py get_full_state_sync() and emits a signal to update QML."""
        try:
            from main import get_full_state_sync
            state = get_full_state_sync()
            self._state = state
            self.systemStateChanged.emit()
        except Exception as e:
            print(f"[UIBridge] Failed to update state: {e}")

    @Slot(str, dict)
    def sendAction(self, action_type, payload):
        """Sends an action to main.py handle_action(). Matches React Socket.IO payload format."""
        # Use asyncio to schedule the action handler
        asyncio.create_task(self._async_handle_action(action_type, payload))

    async def _async_handle_action(self, action_type, payload):
        try:
            from main import handle_action
            await handle_action(None, {"type": action_type, "payload": payload})
            # Force UI update after processing action
            self.update_state()
        except Exception as e:
            print(f"[UIBridge] Action execution failed: {e}")
