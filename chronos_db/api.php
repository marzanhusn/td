<?php
header('Content-Type: application/json');
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

// FETCH ALL TASKS
if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, text, title, time, era, done, alarm_fired FROM tasks ORDER BY id DESC");
    $tasks = $stmt->fetchAll();

    // Format boolean values for JS
    foreach ($tasks as &$task) {
        $task['id'] = (int)$task['id'];
        $task['done'] = (bool)$task['done'];
        $task['alarmFired'] = (bool)$task['alarm_fired'];
        unset($task['alarm_fired']);
    }

    echo json_encode($tasks);
    exit;
}

// READ JSON INPUT FOR POST/PUT/DELETE
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'POST') {
    $action = $input['action'] ?? '';

    // ADD TASK
    if ($action === 'add') {
        $text  = trim($input['text'] ?? '');
        $title = trim($input['title'] ?? '');
        $time  = trim($input['time'] ?? '');
        $era   = trim($input['era'] ?? 'today');

        if (!empty($text)) {
            $stmt = $pdo->prepare("INSERT INTO tasks (text, title, time, era) VALUES (:text, :title, :time, :era)");
            $stmt->execute([
                ':text'  => $text,
                ':title' => $title,
                ':time'  => $time,
                ':era'   => $era
            ]);

            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Task text is required']);
        }
        exit;
    }

    // TOGGLE DONE STATUS
    if ($action === 'toggle') {
        $id = (int)($input['id'] ?? 0);
        if ($id) {
            $stmt = $pdo->prepare("UPDATE tasks SET done = NOT done, alarm_fired = CASE WHEN done = 0 THEN 1 ELSE alarm_fired END WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true]);
        }
        exit;
    }

    // DELETE TASK
    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true]);
        }
        exit;
    }
}