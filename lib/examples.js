export const EXAMPLES = {
  basics: `<?php
$name = "World";
$items = array('apple', 'banana', 'cherry');
$prices = ['apple' => 1.5, 'banana' => 0.25];

function greet(string $who, int $times = 1): string {
    $out = '';
    for ($i = 0; $i < $times; $i++) {
        $out .= "Hello, $who! ";
    }
    return trim($out);
}

echo greet($name, 2);
echo "We have " . count($items) . " items";

foreach ($prices as $fruit => $price) {
    if ($price > 1) {
        $label = 'pricey';
    } elseif ($price > 0.5) {
        $label = 'fair';
    } else {
        $label = 'cheap';
    }
    echo "{$fruit} is $label";
}

$upper = array_map(fn($i) => strtoupper($i), $items);
echo implode(', ', $upper);
`,
  class: `<?php
class User {
    private $name;
    protected int $age = 0;
    const ROLE = 'member';

    public function __construct($name, $age) {
        $this->name = $name;
        $this->age = $age;
    }

    public function describe(): string {
        return "{$this->name} is {$this->age} years old";
    }

    public static function make(array $data): User {
        return new User($data['name'], $data['age'] ?? 0);
    }
}

$u = User::make(['name' => 'Ada', 'age' => 36]);
echo $u->describe();

try {
    if (!isset($u)) {
        throw new Exception("no user");
    }
} catch (Exception $e) {
    echo $e->getMessage();
}
`,
  web: `<?php
$id = intval($_GET['id'] ?? 0);
$user = ['id' => $id, 'name' => 'Ada'];
header('Content-Type: application/json');
echo json_encode($user);
?>
<h1>Hello <?= $user['name'] ?></h1>
<?php if ($id > 0): ?>
  <p>user #<?= $id ?></p>
<?php endif; ?>
`,
};
