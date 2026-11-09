# Reflexión técnica

**¿Dónde redujo la IA la carga cognitiva y dónde la aumentó? ¿Cómo se evitó la deuda técnica?**

## Dónde la redujo

La IA quitó casi todo el trabajo mecánico. Los repositorios en memoria, los validadores de entrada, las rutas de
Express y la documentación de la API son código predecible que habría tomado horas escribir a mano; la IA los
produjo en minutos y con un estilo consistente. También redujo la carga al pensar casos de prueba: para `agendarCita`
propuso doce, entre ellos uno que no era obvio, el de las citas contiguas, que obligó a definir los horarios como
intervalos semiabiertos. Y en el diseño inicial dio un punto de partida completo (esquema, índices, estructura de
carpetas) que solo había que cuestionar, no inventar.

## Dónde la aumentó

La carga no desapareció: se movió de escribir a verificar, y verificar resultó más difícil. El ejemplo más claro es la
condición de carrera. Las doce pruebas de agendamiento pasaban y el código se veía correcto; aun así, dos solicitudes
simultáneas guardaban dos citas en el mismo horario del mismo veterinario, justo lo que el requerimiento prohíbe. Solo
apareció al pedir una revisión crítica y, sobre todo, al escribir una prueba que lo demostrara. Código que parece
correcto exige más atención que código que se ve mal.

También aumentó al vigilar la consistencia. La IA escribió en `AGENTS.md` que no debía haber `if` por modalidad y poco
después generó ese `if`; cometió el error del doble punto en la fecha dos veces, en el correo y en el frontend. Hubo
además una falsa alarma: la compuerta de cobertura pareció no funcionar y resultó que Node trunca el umbral a entero.
Investigarla costó tiempo, pero evitó "arreglar" algo que funcionaba.

## Cómo se evitó la deuda técnica

La regla fue no aceptar nada solo porque la IA lo dijera. En concreto:

1. **TDD con evidencia.** Cada módulo tiene un commit con sus pruebas fallando antes de la implementación.
2. **Reglas ejecutables, no solo escritas.** Lo importante de `AGENTS.md` se convirtió en ESLint (sin `any`, sin
   `new Date()` en el dominio) y en pruebas de arquitectura que fallan si un módulo importa las clases internas de otro.
3. **Compuerta en la CI.** GitHub Actions corre linter y pruebas en cada push y falla si la cobertura baja de 80 %
   (hoy es 99.37 %).
4. **Cada hallazgo de la revisión, demostrado con una prueba** antes de corregirlo; esas pruebas quedaron como
   regresión.
5. **Nada de código sin probar.** El adaptador MySQL no se escribió porque no había forma de probarlo; el esquema y la
   interfaz quedaron listos. Un adaptador sin pruebas habría sido deuda escondida.
6. **Deuda visible.** Lo que falta (autenticación, persistencia real, bloqueo distribuido) está escrito como riesgo
   aceptado en `docs/code-review.md`, no oculto.

La lección coincide con la de la clase: la IA es un escritor de código muy rápido, pero el criterio para decidir
qué código merece quedarse no se puede delegar.
