export interface UserProfile {
  email: string;
  name: string;
  icon: string;
  birthday: string;
}

export interface Task {
  task_id: string;
  user_id: string;
  title: string;
  description: string; // 担当者（email または "private"）
  due_date: string;    // 日本時間の期日文字列
  status: number;      // 0: 未完了, 1: 完了, 2: ゴミ箱
  display_scope: 'shared' | 'private';
  category: 'shopping' | 'dateideas' | 'shared';
  created_at: string;  // 作成日時
}