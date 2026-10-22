<?php
class User {
    public function __construct(public $email, public $name) {}

    public function greeting() {
        $first = explode(' ', $this->name)[0];
        return "Welcome back, $first!";
    }
}
