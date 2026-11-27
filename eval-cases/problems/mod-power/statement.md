# Modular power

Read an integer `t` (1 ≤ t ≤ 10), then `t` lines, each holding three integers `a`, `b` and `m`
(0 ≤ a ≤ 10^9, 0 ≤ b ≤ 10^6, 1 ≤ m ≤ 10^9). For each line, print `a` to the power `b`, modulo
`m`, on its own line. Take `a` to the power 0 to be 1, so the answer is then `1 mod m`.

## Example

Input:

```
3
2 10 1000
3 0 7
5 3 1
```

Output:

```
24
1
0
```

Time limit 1 second, memory limit 256 MB.
