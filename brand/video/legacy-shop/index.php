<?php
require 'config.php';
require 'lib/helpers.php';

$title = APP_NAME;
$featured = ['Mug', 'Shirt', 'Poster'];
?>
<h1><?= $title ?></h1>
<p>We have <?= count($featured) ?> featured items</p>
