// D2: select next pitch. The web app wraps at its current pitch count.
// D3: send selected pitch; D4: reset selection to zero.
// Connect each button between its pin and GND. No buzzer needed.
const byte COUNT = 3;
const byte pins[COUNT] = {2, 3, 4};
int lastReading[COUNT];
int stableState[COUNT];
unsigned long changedAt[COUNT];
void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < COUNT; i++) {
    pinMode(pins[i], INPUT_PULLUP);
    lastReading[i] = HIGH;
    stableState[i] = HIGH;
    changedAt[i] = 0;
  }
  Serial.println("READY");
}
void loop() {
  unsigned long now = millis();
  for (byte i = 0; i < COUNT; i++) {
    int reading = digitalRead(pins[i]);
    if (reading != lastReading[i]) {
      lastReading[i] = reading;
      changedAt[i] = now;
    }
    if (now - changedAt[i] >= 30 && reading != stableState[i]) {
      stableState[i] = reading;
      if (stableState[i] == LOW) {
        if (i == 0) Serial.println("NEXT");
        else if (i == 1) Serial.println("SEND");
        else Serial.println("RESET");
      }
    }
  }
}
