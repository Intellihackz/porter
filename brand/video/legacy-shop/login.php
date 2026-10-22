<?php
session_start();
$email = $_POST['email'] ?? '';
if (!isset($_SESSION['user'])) {
    echo "Please log in, $email";
}
