# Test notes

- Use real CircuitCore transforms and component definitions for regression coverage; checking only a wire's endpoints did not prove a rotated device pin connected.
- File tests operate in OS temporary folders and never alter user projects.
- Editor startup tests terminate their own process by its returned PID.
