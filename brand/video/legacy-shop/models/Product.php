<?php
class Product {
    private $name;
    private $price;
    protected $tags = [];

    public function __construct($name, $price, array $tags = []) {
        $this->name = $name;
        $this->price = $price;
        $this->tags = $tags;
    }

    public function label(): string {
        return "{$this->name} ({$this->price})";
    }

    public function hasTag($tag): bool {
        return in_array($tag, $this->tags);
    }

    public static function fromArray(array $row): Product {
        return new Product($row['name'], $row['price'], $row['tags'] ?? []);
    }
}
