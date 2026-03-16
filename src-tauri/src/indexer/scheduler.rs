use std::sync::Arc;
use tokio::sync::{Mutex, Notify};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum IndexerState {
    Idle,
    Running,
    Paused,
}

#[derive(Clone)]
pub struct Scheduler {
    state: Arc<Mutex<IndexerState>>,
    pause_notifier: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(IndexerState::Idle)),
            pause_notifier: Arc::new(Notify::new()),
        }
    }

    pub async fn get_state(&self) -> IndexerState {
        let guard = self.state.lock().await;
        *guard
    }

    pub async fn set_state(&self, new_state: IndexerState) {
        let mut guard = self.state.lock().await;
        *guard = new_state;
        if new_state == IndexerState::Running {
            self.pause_notifier.notify_waiters();
        }
    }

    /// Call this inside indexing loops. It will block if the state is Paused.
    /// Returns false if the indexing should abort (e.g. state went to Idle abruptly).
    pub async fn wait_if_paused(&self) -> bool {
        loop {
            let state = self.get_state().await;
            match state {
                IndexerState::Running => return true,
                IndexerState::Idle => return false,
                IndexerState::Paused => {
                    self.pause_notifier.notified().await;
                    // Loop around and check state again
                }
            }
        }
    }
}
